import { getAdmin } from "@/lib/firebase/admin";
import { getSchoolId } from "@/lib/firebase/config";
import { HttpError, json, jsonError, requireUser } from "@/lib/auth/server";
import { fsPaths, type TimetableDoc } from "@/shared/codec";
import { deleteCollection } from "../../_lib/batch";
import { parseId } from "../../_lib/common";
import { loadActiveTermId } from "../../_lib/server-data";

export const runtime = "nodejs";

/** ลบตาราง (ห้ามลบฉบับที่เผยแพร่อยู่) */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser(req, ["admin"]);
    const { db } = (await getAdmin())!;
    const { FieldValue } = await import("firebase-admin/firestore");
    const id = parseId((await params).id);
    const schoolId = getSchoolId();
    const termId = await loadActiveTermId(db, schoolId);
    const ref = db.doc(`${fsPaths.timetables(schoolId, termId)}/${id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "ไม่พบตาราง");
    const data = snap.data() as TimetableDoc;
    if (data.status === "published") throw new HttpError(409, "ลบตารางที่เผยแพร่อยู่ไม่ได้ — เผยแพร่ฉบับอื่นก่อน");

    await deleteCollection(db, fsPaths.views(schoolId, termId, id));
    const batch = db.batch();
    batch.delete(ref);
    batch.set(db.collection(fsPaths.auditLog(schoolId)).doc(), {
      at: FieldValue.serverTimestamp(),
      actorUid: user.uid,
      action: "timetable.delete",
      entityType: "timetable",
      entityId: id,
      termId,
    });
    await batch.commit();
    return json({ ok: true, id });
  } catch (e) {
    return jsonError(e);
  }
}
