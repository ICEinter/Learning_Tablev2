import { z } from "zod";
import { getAdmin } from "@/lib/firebase/admin";
import { getSchoolId } from "@/lib/firebase/config";
import { HttpError, json, jsonError, readJson, requireUser } from "@/lib/auth/server";
import { fsPaths, packedSizeBytes, timetableToDoc, type TimetableDoc } from "@/shared/codec";
import { PlacementSchema } from "@/shared/schemas";
import type { TimetableVersion } from "@/shared/types";
import { DocIdSchema, runValidate } from "../_lib/common";
import { loadServerDataset } from "../_lib/server-data";

export const runtime = "nodejs";

const MAX_DOC_BYTES = 900 * 1024; // เผื่อจากเพดาน 1 MiB ของ Firestore

const TimetableSchema = z.object({
  id: DocIdSchema,
  termId: z.string().min(1),
  label: z.string().trim().min(1, "ต้องระบุชื่อตาราง").max(120),
  status: z.enum(["draft", "published", "archived"]),
  placements: z.array(PlacementSchema).max(20000, "จำนวนคาบในตารางมากเกินกำหนด"),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  publishedAt: z.string().optional(),
  source: z.object({ algorithm: z.string().max(40), seed: z.number().optional(), jobId: z.string().max(64).optional() }),
  metrics: z.object({ hard: z.number(), soft: z.number(), elapsedMs: z.number().optional() }).optional(),
  note: z.string().max(2000).optional(),
});

const BodySchema = z.object({
  timetable: TimetableSchema,
  /** updatedAt ที่ client เห็นล่าสุด (null = สร้างใหม่) ใช้ทำ optimistic concurrency */
  expectedUpdatedAt: z.string().nullable().optional(),
});

/** บันทึกตารางฉบับร่าง: server ตรวจด้วย validator แล้วเก็บแบบ packed 1 doc */
export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireUser(req, ["admin"]);
    const { db } = (await getAdmin())!;
    const { timetable, expectedUpdatedAt } = BodySchema.parse(await readJson(req));
    if (timetable.status !== "draft") throw new HttpError(409, "บันทึก/แก้ไขได้เฉพาะตารางฉบับร่าง (draft)");

    const schoolId = getSchoolId();
    const { dataset, termId } = await loadServerDataset(db, schoolId);
    if (timetable.termId !== termId) throw new HttpError(400, "ภาคเรียนของตารางไม่ตรงกับภาคเรียนปัจจุบัน");

    const result = await runValidate(dataset, timetable.placements);
    const metrics = { hard: result.score.hard, soft: result.score.soft, elapsedMs: timetable.metrics?.elapsedMs };
    const ref = db.doc(`${fsPaths.timetables(schoolId, termId)}/${timetable.id}`);

    const updatedAt = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.data() as TimetableDoc | undefined;
      if (existing && existing.status !== "draft") {
        throw new HttpError(409, "ตารางนี้เผยแพร่หรือเก็บถาวรแล้ว แก้ไขไม่ได้ — กรุณาสร้างฉบับร่างใหม่");
      }
      if (expectedUpdatedAt !== undefined) {
        const current = existing?.updatedAt ?? null;
        if (current !== expectedUpdatedAt) {
          throw new HttpError(409, "ตารางถูกแก้ไขโดยผู้อื่นหลังจากที่คุณโหลด กรุณาโหลดใหม่ก่อนบันทึก", {
            currentUpdatedAt: current,
          });
        }
      }
      let now = new Date().toISOString();
      if (existing && now <= existing.updatedAt) now = new Date(Date.parse(existing.updatedAt) + 1).toISOString();
      const doc = timetableToDoc(
        { ...(timetable as TimetableVersion), createdAt: existing?.createdAt ?? timetable.createdAt, publishedAt: undefined },
        metrics,
        { updatedAt: now, createdBy: existing?.createdBy ?? user.uid },
      );
      if (packedSizeBytes(doc) > MAX_DOC_BYTES) throw new HttpError(413, "ตารางมีขนาดใหญ่เกินกว่าจะบันทึกใน 1 เอกสาร");
      tx.set(ref, doc);
      return now;
    });

    return json({
      id: timetable.id,
      updatedAt,
      metrics: { hard: metrics.hard, soft: metrics.soft },
      violationCount: result.violations.length,
    });
  } catch (e) {
    return jsonError(e);
  }
}
