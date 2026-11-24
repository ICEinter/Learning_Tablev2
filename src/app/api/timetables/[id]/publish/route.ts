import { getAdmin } from "@/lib/firebase/admin";
import { getSchoolId } from "@/lib/firebase/config";
import { HttpError, json, jsonError, requireUser } from "@/lib/auth/server";
import { decodePlacements, fsPaths, type TimetableDoc } from "@/shared/codec";
import { commitInChunks, deleteCollection } from "../../../_lib/batch";
import { parseId, runValidate } from "../../../_lib/common";
import { loadServerDataset } from "../../../_lib/server-data";
import { buildViews } from "../../../_lib/views";

export const runtime = "nodejs";

/**
 * เผยแพร่ตาราง: ตรวจซ้ำด้วย validator → ปฏิเสธถ้า Hard > 0
 * → เขียน views (มองไม่เห็นจนกว่าสถานะจะเป็น published เพราะ rules ตรวจสถานะของเวอร์ชัน)
 * → transaction: ตั้ง published, เก็บฉบับเดิมเป็น archived, term.publishedVersionId, auditLog
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser(req, ["admin"]);
    const { db } = (await getAdmin())!;
    const { FieldValue } = await import("firebase-admin/firestore");
    const id = parseId((await params).id);
    const schoolId = getSchoolId();
    const { dataset, termId } = await loadServerDataset(db, schoolId);
    const ttCol = db.collection(fsPaths.timetables(schoolId, termId));
    const ref = ttCol.doc(id);

    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "ไม่พบตาราง");
    const tt = snap.data() as TimetableDoc;
    if (tt.status === "published") throw new HttpError(409, "ตารางนี้เผยแพร่อยู่แล้ว");

    const placements = decodePlacements(tt);
    const result = await runValidate(dataset, placements);
    if (result.score.hard > 0) {
      throw new HttpError(422, `เผยแพร่ไม่ได้: ยังมีข้อขัดแย้ง Hard ${result.score.hard} รายการ`, {
        hard: result.score.hard,
        violationCount: result.violations.filter((v) => v.severity === "hard").length,
      });
    }

    // views: ลบของเดิม (ถ้ามี) แล้วเขียนใหม่เป็นชุด
    const viewsPath = fsPaths.views(schoolId, termId, id);
    await deleteCollection(db, viewsPath);
    const views = buildViews(dataset, placements, id);
    await commitInChunks(
      db,
      [...views].map(([viewId, data]) => ({ kind: "set" as const, ref: db.doc(`${viewsPath}/${viewId}`), data })),
    );

    const publishedAt = new Date().toISOString();
    const archived = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      const cur = fresh.data() as TimetableDoc | undefined;
      if (!cur || cur.updatedAt !== tt.updatedAt || cur.status === "published") {
        throw new HttpError(409, "ตารางถูกแก้ไขระหว่างการเผยแพร่ กรุณาลองใหม่");
      }
      const prev = await tx.get(ttCol.where("status", "==", "published"));
      for (const d of prev.docs) {
        if (d.id !== id) tx.update(d.ref, { status: "archived", updatedAt: publishedAt });
      }
      tx.update(ref, {
        status: "published",
        publishedAt,
        publishedBy: user.uid,
        updatedAt: publishedAt,
        hardViolations: 0,
        softScore: result.score.soft,
        metrics: { ...(cur.metrics ?? {}), hard: 0, soft: result.score.soft },
      });
      tx.set(db.doc(fsPaths.term(schoolId, termId)), { publishedVersionId: id }, { merge: true });
      tx.set(db.collection(fsPaths.auditLog(schoolId)).doc(), {
        at: FieldValue.serverTimestamp(),
        actorUid: user.uid,
        action: "timetable.publish",
        entityType: "timetable",
        entityId: id,
        termId,
        diff: { archived: prev.docs.map((d) => d.id).filter((x) => x !== id), soft: result.score.soft },
      });
      return prev.docs.map((d) => d.id).filter((x) => x !== id);
    });

    return json({ ok: true, id, publishedAt, views: views.size, archived, soft: result.score.soft });
  } catch (e) {
    return jsonError(e);
  }
}
