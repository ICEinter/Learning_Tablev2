/**
 * [ทางเลือก — ยังไม่ได้ทดสอบบน Netlify จริง และไม่มีหน้า UI เรียกใช้]
 * Netlify Background Function (ชื่อไฟล์ลงท้าย -background → ตอบ 202 ทันที, รันได้ ≤ 15 นาที)
 *
 * POST /.netlify/functions/solve-background
 *   Authorization: Bearer <Firebase ID token ของ admin>
 *   body: { jobId, algorithm?, seed?, timeLimitMs? }   (payload ≤ 256 KB — ส่งแค่ jobId/พารามิเตอร์)
 *
 * ขั้นตอน: ตรวจ token admin → สร้าง/อ่าน job (idempotent ต่อ retry) → โหลด dataset ด้วย Admin SDK
 *   → solve() พร้อม time limit → validate ซ้ำ → เขียนตาราง draft (packed 1 doc) + สถานะ job
 * ระหว่างรัน: heartbeat ทุก ≥ 5 วินาที และตรวจ cancelRequested ทุก ≥ 10 วินาที
 */
import { z } from "zod";
import { DEFAULT_WEIGHTS, solve, validate, type Algorithm } from "../../src/engine";
import { getAdmin } from "../../src/lib/firebase/admin";
import { getSchoolId } from "../../src/lib/firebase/config";
import { requireUser } from "../../src/lib/auth/server";
import { fsPaths, timetableToDoc } from "../../src/shared/codec";
import { loadServerDataset } from "../../src/app/api/_lib/server-data";

const MAX_MS = 14 * 60 * 1000; // เผื่อเวลาเขียนผลก่อนครบ 15 นาที

const BodySchema = z.object({
  jobId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  algorithm: z.enum(["heuristic", "ga", "agent"]).optional(),
  seed: z.number().int().optional(),
  timeLimitMs: z.number().int().min(1000).max(MAX_MS).optional(),
});

export default async (req: Request): Promise<Response> => {
  let jobRef: FirebaseFirestore.DocumentReference | null = null;
  try {
    const user = await requireUser(req, ["admin"]);
    const { db } = getAdmin()!;
    const body = BodySchema.parse(await req.json());
    const schoolId = getSchoolId();
    const { dataset, termId } = await loadServerDataset(db, schoolId);
    jobRef = db.doc(`schools/${schoolId}/terms/${termId}/solverJobs/${body.jobId}`);

    // idempotent: รับงานเฉพาะเมื่อยังไม่เคยเริ่ม (Netlify อาจ retry เมื่อ fail)
    const started = await db.runTransaction(async (tx) => {
      const snap = await tx.get(jobRef!);
      const status = snap.data()?.status;
      if (snap.exists && status !== "queued") return false;
      const now = new Date().toISOString();
      tx.set(
        jobRef!,
        {
          status: "running",
          runner: "netlify-bg",
          algorithm: body.algorithm ?? snap.data()?.algorithm ?? "heuristic",
          seed: body.seed ?? snap.data()?.seed ?? Date.now() % 100000,
          progress: 0,
          requestedBy: user.uid,
          createdAt: snap.data()?.createdAt ?? now,
          startedAt: now,
          heartbeatAt: now,
          logTail: [],
        },
        { merge: true },
      );
      return true;
    });
    if (!started) return new Response(null, { status: 202 });

    const job = (await jobRef.get()).data()!;
    const timeLimitMs = Math.min(body.timeLimitMs ?? MAX_MS, MAX_MS);
    const signal = { cancelled: false };
    let lastBeat = Date.now();
    let lastCancelCheck = Date.now();

    const result = await solve(
      dataset,
      { algorithm: job.algorithm as Algorithm, seed: job.seed as number, timeLimitMs, weights: DEFAULT_WEIGHTS },
      {
        signal,
        onProgress: (e) => {
          const now = Date.now();
          if (now - lastBeat >= 5000) {
            lastBeat = now;
            void jobRef!
              .update({
                heartbeatAt: new Date().toISOString(),
                progress: Math.min(0.99, e.elapsedMs / timeLimitMs),
                metrics: { hard: e.bestHard, soft: e.bestSoft, iterations: e.iteration, elapsedMs: e.elapsedMs },
              })
              .catch(() => undefined);
          }
          if (now - lastCancelCheck >= 10000) {
            lastCancelCheck = now;
            void jobRef!
              .get()
              .then((s) => {
                if (s.data()?.cancelRequested) signal.cancelled = true;
              })
              .catch(() => undefined);
          }
        },
      },
    );

    // ไม่เชื่อผลจาก solver โดยตรง — validate ซ้ำ
    const check = validate(dataset, result.placements);
    const now = new Date().toISOString();
    const versionId = `tt-${body.jobId}`;
    const ttDoc = timetableToDoc(
      {
        id: versionId,
        termId,
        label: `ผลจาก ${job.algorithm} (Netlify) ${now.slice(0, 16).replace("T", " ")}`,
        status: "draft",
        placements: result.placements,
        createdAt: now,
        updatedAt: now,
        source: { algorithm: String(job.algorithm), seed: job.seed as number, jobId: body.jobId },
      },
      { hard: check.score.hard, soft: check.score.soft, elapsedMs: result.stats.elapsedMs },
      { updatedAt: now, createdBy: user.uid },
    );
    const batch = db.batch();
    batch.set(db.doc(`${fsPaths.timetables(schoolId, termId)}/${versionId}`), ttDoc);
    batch.update(jobRef, {
      status: result.status === "cancelled" ? "cancelled" : check.score.hard === 0 ? "succeeded" : "partial",
      progress: 1,
      finishedAt: now,
      heartbeatAt: now,
      resultVersionId: versionId,
      metrics: {
        hard: check.score.hard,
        soft: check.score.soft,
        iterations: result.stats.iterations,
        elapsedMs: result.stats.elapsedMs,
      },
      logTail: result.log.slice(-50),
    });
    await batch.commit();
    return new Response(null, { status: 202 });
  } catch (e) {
    console.error("[solve-background] failed:", e instanceof Error ? e.message : "unknown");
    if (jobRef) {
      await jobRef
        .set({ status: "failed", finishedAt: new Date().toISOString(), logTail: ["งานล้มเหลว — ดู log ของ Netlify"] }, { merge: true })
        .catch(() => undefined);
    }
    return new Response(null, { status: 202 });
  }
};
