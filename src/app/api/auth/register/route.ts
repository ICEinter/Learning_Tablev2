import { z } from "zod";
import { getAdmin, isAdminConfigured } from "@/lib/firebase/admin";
import { setFirebaseCustomClaims, type FirebaseCustomClaims } from "@/lib/firebase/auth-rest";
import { getSchoolId } from "@/lib/firebase/config";
import { HttpError, json, jsonError, readJson } from "@/lib/auth/server";
import { fsPaths } from "@/shared/codec";
import type { Student } from "@/shared/types";
import { DocIdSchema } from "../../_lib/common";
import { loadActiveTermId } from "../../_lib/server-data";

export const runtime = "nodejs";

const RegisterSchema = z
  .object({
    email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
    password: z.string().min(6, "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร").max(128),
    displayName: z.string().trim().min(1, "ต้องระบุชื่อที่แสดง").max(80),
    // Public registration cannot grant administrative access. The first admin is provisioned by a trusted script.
    role: z.enum(["teacher", "student"]),
    teacherId: DocIdSchema.optional(),
    studentId: DocIdSchema.optional(),
  });

export async function POST(req: Request): Promise<Response> {
  try {
    const body = RegisterSchema.parse(await readJson(req, 64 * 1024));
    const schoolId = getSchoolId();

    if (!isAdminConfigured()) throw new HttpError(503, "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า Firebase Admin สำหรับสมัครบัญชี");
    const admin = await getAdmin();
    if (!admin) throw new HttpError(503, "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า Firebase Admin สำหรับสมัครบัญชี");
    const { db, auth } = admin;

    // ตรวจสอบ claims และข้อมูลอ้างอิง
    const claims: FirebaseCustomClaims = { schoolId, role: body.role };

    if (body.role === "teacher" && body.teacherId) {
      let termId: string;
      try {
        termId = await loadActiveTermId(db, schoolId);
      } catch {
        throw new HttpError(400, "ตรวจสอบข้อมูลครูไม่สำเร็จ กรุณาตรวจภาคเรียนปัจจุบัน");
      }
      const t = await db.doc(`${fsPaths.entity(schoolId, termId, "teachers")}/${body.teacherId}`).get();
      if (!t.exists) throw new HttpError(400, "ไม่พบข้อมูลครูที่เลือก");
      claims.teacherId = body.teacherId;
    }

    if (body.role === "student" && body.studentId) {
      const s = await db.doc(`${fsPaths.students(schoolId)}/${body.studentId}`).get();
      if (!s.exists) throw new HttpError(400, "ไม่พบข้อมูลนักเรียนที่เลือก");
      const student = s.data() as Omit<Student, "id">;
      claims.studentId = body.studentId;
      claims.groupIds = student.groupId ? [student.groupId] : [];
    }

    // สร้างบัญชีใน Firebase Auth
    let uid: string;
    try {
      const created = await auth.createUser({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
      });
      uid = created.uid;
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code.includes("email-already-exists")) {
        throw new HttpError(409, "อีเมลนี้มีบัญชีในระบบอยู่แล้ว กรุณาเข้าสู่ระบบ");
      }
      if (code.includes("invalid-password")) {
        throw new HttpError(400, "รหัสผ่านไม่ผ่านเกณฑ์ความปลอดภัยของ Firebase");
      }
      throw e;
    }

    // บันทึก custom claims และ user profile
    try {
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        await auth.setCustomUserClaims(uid, claims);
      } else {
        await setFirebaseCustomClaims(uid, claims);
      }
      await db.doc(`${fsPaths.users}/${uid}`).set({
        schoolId,
        email: body.email,
        displayName: body.displayName,
        role: body.role,
        teacherId: claims.teacherId ?? null,
        studentId: claims.studentId ?? null,
        disabled: false,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      await db.doc(`${fsPaths.users}/${uid}`).delete().catch(() => undefined);
      await auth.deleteUser(uid).catch(() => undefined);
      throw e;
    }

    return json({
      ok: true,
      uid,
      role: body.role,
      message: "สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ",
    });
  } catch (e) {
    return jsonError(e);
  }
}

