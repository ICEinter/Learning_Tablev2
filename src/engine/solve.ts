/**
 * solve(): ตัวประสานงาน precheck → heuristic/GA/agent → validate (ผู้ตัดสินจริง) → explanation
 * - async: yield ให้ event loop ทุก ~40ms, ตรวจ signal.cancelled และ deadline
 * - สถานะ feasible เฉพาะเมื่อ validate() ให้ hard = 0
 * - infeasible-proven เฉพาะเมื่อมี proof ≥ 1 ข้อ
 */
import type { Dataset } from "@/shared/types";
import { runAgent } from "./agent";
import { runCore } from "./core";
import { finalize } from "./finalize";
import { Ctl, now } from "./ctl";
import { buildModel } from "./model";
import { precheck } from "./precheck";
import {
  DEFAULT_GA,
  DEFAULT_WEIGHTS,
  SOFT_KEYS,
  type GAOptions,
  type SolveHooks,
  type SolverOptions,
  type SolverResult,
  type Weights,
} from "./types";

export function normalizeWeights(w?: Partial<Weights>): Weights {
  const out = { ...DEFAULT_WEIGHTS };
  if (w) for (const k of SOFT_KEYS) if (typeof w[k] === "number" && Number.isFinite(w[k]) && w[k]! >= 0) out[k] = w[k]!;
  return out;
}

export function normalizeGA(g?: Partial<GAOptions>): GAOptions {
  return { ...DEFAULT_GA, ...(g ?? {}) };
}

export async function solve(ds: Dataset, options: SolverOptions, hooks?: SolveHooks): Promise<SolverResult> {
  const t0 = now();
  const timeLimit = Math.max(50, Number.isFinite(options.timeLimitMs) ? options.timeLimitMs : 5000);
  const ctl = new Ctl(t0, t0 + timeLimit, hooks);
  const weights = normalizeWeights(options.weights);
  const ga = normalizeGA(options.ga);
  const seed = (options.seed ?? 1) >>> 0;
  const log: string[] = [];
  try {
    ctl.progress({ phase: "precheck", iteration: 0, bestHard: -1, bestSoft: -1, message: "ตรวจความเป็นไปได้เบื้องต้น" }, true);
    const m = buildModel(ds);
    const proofs = precheck(ds, m);
    log.push(`ข้อมูล: ${ds.assignments.length} รายการมอบหมาย, ${m.blocks.length} block, ${m.blocks.reduce((s, b) => s + b.len, 0)} คาบ, ${m.S} slot/สัปดาห์`);
    log.push(proofs.length ? `pre-check พบหลักฐาน ${proofs.length} ข้อ: ${[...new Set(proofs.map((p) => p.rule))].join(", ")}` : "pre-check ไม่พบหลักฐานว่าจัดไม่ได้");
    if (options.algorithm === "agent") return await runAgent({ ds, m, proofs, options, weights, ga, seed, ctl, log, t0 });

    const algorithm = options.algorithm === "ga" ? "ga" : options.algorithm === "tabu" ? "tabu" : "heuristic";
    // มี proof → รัน heuristic สั้น ๆ เพื่อให้มีตารางร่างแสดง (สถานะยังเป็น infeasible-proven)
    const runCtl = proofs.length ? ctl.child(t0 + Math.max(200, timeLimit * 0.3)) : ctl;
    const res = await runCore(m, { algorithm: proofs.length ? "heuristic" : algorithm, seed, weights, ga, maxIterations: options.maxIterations, initial: options.initial }, runCtl);
    log.push(`${algorithm === "ga" && !proofs.length ? "GA" : algorithm === "tabu" && !proofs.length ? "Tabu Search" : "Heuristic"}: ${res.iterations} รอบ, hard ภายใน ${res.internalHard}`);
    ctl.progress({ phase: "validate", iteration: res.iterations, bestHard: res.internalHard, bestSoft: res.internalSoft }, true);
    return finalize({
      ds,
      algorithm,
      seed,
      placements: res.placements,
      proofs,
      weights,
      cancelled: res.stopped === "cancelled",
      timedOut: res.stopped === "time",
      iterations: res.iterations,
      t0,
      history: res.history,
      log,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "error",
      placements: [],
      score: { hard: 0, soft: 0, breakdown: { teacherGaps: 0, studentGaps: 0, dayBalance: 0, roomChanges: 0, preferredTimes: 0, sameCourseSameDay: 0, lateHours: 0 } },
      violations: [],
      proofs: [],
      stats: { algorithm: options.algorithm, seed, iterations: 0, elapsedMs: Math.round(now() - t0), bestHistory: [] },
      log: [...log, `เกิดข้อผิดพลาด: ${msg}`],
      explanation: [`เกิดข้อผิดพลาดระหว่างจัดตาราง: ${msg}`],
    };
  }
}
