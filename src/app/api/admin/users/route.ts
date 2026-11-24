import { z } from "zod";
import { getAdmin } from "@/lib/firebase/admin";
import { setFirebaseCustomClaims, type FirebaseCustomClaims } from "@/lib/firebase/auth-rest";
import { getSchoolId } from "@/lib/firebase/config";
import { HttpError, json, jsonError, readJson, requireUser } from "@/lib/auth/server";
import { fsPaths } from "@/shared/codec";
import type { Student } from "@/shared/types";
import { DocIdSchema } from "../../_lib/common";
import { loadActiveTermId } from "../../_lib/server-data";

export const runtime = "nodejs";

const CreateUserSchema = z
  .object({
    email: z.email("อีเมลไม่ถูกต้อง"),
    password: z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร").max(128),
    displayName: z.string().trim().min(1, "ต้องระบุชื่อที่แสดง").max(80),
    role: z.enum(["admin", "teacher", "student"]),
    teacherId: DocIdSchema.optional(),
    studentId: DocIdSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "teacher" && !v.teacherId)
      ctx.addIssue({ code: "custom", path: ["teacherId"], message: "บัญชีครูต้องผูกกับข้อมูลครู (teacherId)" });
    if (v.role === "student" && !v.studentId)
      ctx.addIssue({ code: "custom", path: ["studentId"], message: "บัญชีนักเรียนต้องผูกกับข้อมูลนักเรียน (studentId)" });
  });

const PAGE = 200;

/** รายชื่อผู้ใช้ของสถานศึกษานี้ (แบ่งหน้า ?after=<uid>) */
export async function GET(req: Request): Promise<Response> {
  try {
    await requireUser(req, ["admin"]);
    const { db } = (await getAdmin())!;
    const { FieldPath } = await import("firebase-admin/firestore");
    const after = new URL(req.url).searchParams.get("after");
    let q = db
      .collection(fsPaths.users)
      .where("schoolId", "==", getSchoolId())
      .orderBy(FieldPath.documentId())
      .limit(PAGE);
    if (after) q = q.startAfter(DocIdSchema.parse(after));
    const snap = await q.get();
    const users = snap.docs.map((d) => {
      const u = d.data();
      return {
        uid: d.id,
        email: u.email ?? "",
        displayName: u.displayName ?? "",
        role: u.role,
        teacherId: u.teacherId,
        studentId: u.studentId,
        disabled: Boolean(u.disabled),
      };
    });
    return json({ users, nextCursor: snap.size === PAGE ? snap.docs[snap.size - 1].id : null });
  } catch (e) {
    return jsonError(e);
  }
}

/** สร้างบัญชี + ตั้ง custom claims (ทำได้เฉพาะ admin ผ่าน Admin SDK) */
export async function POST(req: Request): Promise<Response> {
  try {
    const actor = await requireUser(req, ["admin"]);
    const { db, auth } = (await getAdmin())!;
    const body = CreateUserSchema.parse(await readJson(req, 64 * 1024));
    const schoolId = getSchoolId();

    const claims: FirebaseCustomClaims = { schoolId, role: body.role };
    if (body.role === "teacher" && body.teacherId) {
      const termId = await loadActiveTermId(db, schoolId);
      const t = await db.doc(`${fsPaths.entity(schoolId, termId, "teachers")}/${body.teacherId}`).get();
      if (!t.exists) throw new HttpError(400, "ไม่พบข้อมูลครูที่ระบุในภาคเรียนปัจจุบัน");
      claims.teacherId = body.teacherId;
    }
    if (body.role === "student" && body.studentId) {
      const s = await db.doc(`${fsPaths.students(schoolId)}/${body.studentId}`).get();
      if (!s.exists) throw new HttpError(400, "ไม่พบข้อมูลนักเรียนที่ระบุ");
      const student = s.data() as Omit<Student, "id">;
      claims.studentId = body.studentId;
      claims.groupIds = student.groupId ? [student.groupId] : [];
    }

    let uid: string;
    try {
      const created = await auth.createUser({ email: body.email, password: body.password, displayName: body.displayName });
      uid = created.uid;
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code.includes("email-already-exists")) throw new HttpError(409, "อีเมลนี้มีบัญชีอยู่แล้ว");
      if (code.includes("invalid-password")) throw new HttpError(400, "รหัสผ่านไม่ผ่านเงื่อนไขของ Firebase");
      throw e;
    }

    try {
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        await auth.setCustomUserClaims(uid, claims);
      } else {
        await setFirebaseCustomClaims(uid, claims);
      }
      const { FieldValue } = await import("firebase-admin/firestore");
      const batch = db.batch();
      batch.set(db.doc(`${fsPaths.users}/${uid}`), {
        schoolId,
        role: body.role,
        ...(claims.teacherId ? { teacherId: claims.teacherId } : {}),
        ...(claims.studentId ? { studentId: claims.studentId } : {}),
        displayName: body.displayName,
        email: body.email,
        disabled: false,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: actor.uid,
      });
      batch.set(db.collection(fsPaths.auditLog(schoolId)).doc(), {
        at: FieldValue.serverTimestamp(),
        actorUid: actor.uid,
        action: "user.create",
        entityType: "user",
        entityId: uid,
        diff: { role: body.role },
      });
      await batch.commit();
    } catch (e) {
      // ย้อนกลับ: ไม่ปล่อยบัญชีที่ไม่มีโปรไฟล์/claims ค้างไว้
      await auth.deleteUser(uid).catch(() => undefined);
      throw e;
    }

    return json({ uid, email: body.email, role: body.role }, 201);
  } catch (e) {
    return jsonError(e);
  }
}

/** ลบบัญชีผู้ใช้ (Admin เท่านั้น) */
export async function DELETE(req: Request): Promise<Response> {
  try {
    const actor = await requireUser(req, ["admin"]);
    const { db, auth } = (await getAdmin())!;
    const uid = new URL(req.url).searchParams.get("uid");
    if (!uid) throw new HttpError(400, "ต้องระบุ uid ที่ต้องการลบ");
    if (uid === actor.uid) throw new HttpError(400, "ไม่สามารถลบบัญชีของตนเองได้");

    const schoolId = getSchoolId();
    const userDocRef = db.doc(`${fsPaths.users}/${uid}`);
    const userSnap = await userDocRef.get();
    if (userSnap.exists && userSnap.data()?.schoolId !== schoolId) {
      throw new HttpError(403, "ไม่มีสิทธิ์จัดการบัญชีนอกสถานศึกษา");
    }

    await auth.deleteUser(uid).catch(() => undefined);
    await userDocRef.delete();

    return json({ ok: true, deletedUid: uid });
  } catch (e) {
    return jsonError(e);
  }
}
