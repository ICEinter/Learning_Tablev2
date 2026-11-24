/**
 * Agent workflow (rule-based ไม่ใช้ LLM)
 * plan: precheck → มี proof ให้หยุดและรายงานหลักฐาน
 * loop: รัน heuristic/GA → validate (ผู้ตัดสินจริง ใช้น้ำหนักของผู้ใช้) → บันทึก log → ปรับพารามิเตอร์
 * ปรับได้เฉพาะ whitelist: seed, เวลาต่อรอบ, พารามิเตอร์ GA, น้ำหนัก Soft ที่ใช้ "นำทาง" GA
 * ห้ามผ่อน Hard หรือแก้ข้อมูลนำเข้า (agent ไม่เขียนลง Dataset เลย)
 */
import type { Dataset, Placement } from "@/shared/types";
import { runCore } from "./core";
import { now, type Ctl } from "./ctl";
import type { Model } from "./model";
import { forkSeed } from "./rng";
import { finalize } from "./finalize";
import {
  SOFT_KEYS,
  SOFT_LABEL,
  type AgentRoundLog,
  type GAOptions,
  type InfeasibilityProof,
  type Score,
  type SolverOptions,
  type SolverResult,
  type Violation,
  type Weights,
} from "./types";
import { validate } from "./validator";

export interface AgentInput {
  ds: Dataset;
  m: Model;
  proofs: InfeasibilityProof[];
  options: SolverOptions;
  weights: Weights;
  ga: GAOptions;
  seed: number;
  ctl: Ctl;
  log: string[];
  t0: number;
}

const better = (a: Score, b: Score) => a.hard < b.hard || (a.hard === b.hard && a.soft < b.soft - 1e-9);

export async function runAgent(x: AgentInput): Promise<SolverResult> {
  const { ds, m, proofs, options, weights, ctl, log, t0 } = x;
  const rounds: AgentRoundLog[] = [];
  const history: { t: number; hard: number; soft: number }[] = [];
  let iterations = 0;

  if (proofs.length) {
    const t = now();
    const child = ctl.child(t + Math.max(200, (ctl.deadline - t) * 0.3));
    const res = await runCore(m, { algorithm: "heuristic", seed: x.seed, weights, ga: x.ga, round: 1 }, child);
    const v = validate(ds, res.placements, weights);
    rounds.push({
      round: 1,
      algorithm: "heuristic",
      seed: x.seed,
      timeLimitMs: Math.round(child.deadline - t),
      weights: { ...weights },
      durationMs: Math.round(now() - t),
      hard: v.score.hard,
      soft: v.score.soft,
      status: v.score.hard === 0 ? "feasible" : "infeasible-proven",
      decision: `pre-check พบหลักฐาน ${proofs.length} ข้อ (${[...new Set(proofs.map((p) => p.rule))].join(", ")}) — หยุด ไม่ผ่อนข้อจำกัด ไม่แก้ข้อมูล แสดงตารางร่างพร้อมหลักฐานให้ผู้ใช้แก้ข้อมูล`,
    });
    log.push(`Agent รอบ 1: ${rounds[0].decision}`);
    return finalize({ ds, algorithm: "agent", seed: x.seed, placements: res.placements, proofs, weights, cancelled: res.stopped === "cancelled", timedOut: false, iterations: res.iterations, t0, history: res.history, log, agentRounds: rounds });
  }

  const maxRounds = Math.min(10, Math.max(1, Math.floor(options.agent?.maxRounds ?? 5)));
  const target = options.agent?.targetSoft;
  let algorithm: "heuristic" | "ga" = "heuristic";
  let seed = x.seed;
  let steer: Weights = { ...weights };
  let ga: GAOptions = { ...x.ga };
  let timeFactor = 1;
  let best: { placements: Placement[]; score: Score; violations: Violation[] } | null = null;
  let noImprove = 0;
  let cancelled = false;
  let timedOut = false;

  for (let r = 1; r <= maxRounds; r++) {
    if (ctl.cancelled) {
      cancelled = true;
      break;
    }
    if (ctl.timeUp()) {
      timedOut = true;
      break;
    }
    const t = now();
    const remaining = ctl.deadline - t;
    const roundsLeft = maxRounds - r + 1;
    const roundTime = algorithm === "heuristic" ? remaining : Math.min(remaining, (remaining / roundsLeft) * timeFactor);
    const child = ctl.child(t + roundTime);
    const used = { algorithm, seed, weights: { ...steer }, ga: { ...ga } };
    ctl.progress({ phase: "agent", round: r, iteration: iterations, bestHard: best?.score.hard ?? -1, bestSoft: best?.score.soft ?? -1, message: `Agent รอบ ${r}: ${algorithm}` }, true);
    const res = await runCore(
      m,
      { algorithm, seed, weights: steer, ga, round: r, maxIterations: options.maxIterations, initial: algorithm === "ga" ? best?.placements : undefined },
      child,
    );
    iterations += res.iterations;
    for (const h of res.history) history.push(h);
    // ผู้ตัดสิน: validator อิสระ + น้ำหนักของผู้ใช้ (ไม่ใช่น้ำหนักนำทาง)
    const v = validate(ds, res.placements, weights);
    const improved = !best || better(v.score, best.score);
    if (improved) {
      best = { placements: res.placements, score: v.score, violations: v.violations };
      noImprove = 0;
    } else noImprove++;

    let decision: string;
    let stop = false;
    if (res.stopped === "cancelled") {
      decision = "ผู้ใช้ยกเลิก — คืนผลดีที่สุดที่มี";
      cancelled = true;
      stop = true;
    } else if (best!.score.hard === 0 && target !== undefined && best!.score.soft <= target) {
      decision = `ไม่มี Hard และ Soft ${fmt(best!.score.soft)} ≤ เป้าหมาย ${target} — หยุด`;
      stop = true;
    } else if (best!.score.hard === 0 && noImprove >= 2) {
      decision = "ไม่มี Hard และ Soft ไม่ดีขึ้น 2 รอบติดกัน — หยุด";
      stop = true;
    } else if (v.score.hard === 0) {
      const worst = SOFT_KEYS.map((k) => ({ k, v: weights[k] * v.score.breakdown[k] })).sort((a, b) => b.v - a.v)[0];
      if (worst && worst.v > 0) {
        steer = { ...steer, [worst.k]: Math.round(steer[worst.k] * 1.5 * 100) / 100 };
        decision = `ไม่มี Hard แล้ว — Soft ที่แย่สุดคือ "${SOFT_LABEL[worst.k]}" (${v.score.breakdown[worst.k]}) จึงเพิ่มน้ำหนักนำทางเป็น ${steer[worst.k]} แล้วรัน GA ต่อจากผลดีที่สุด`;
      } else {
        decision = "ไม่มี Hard และไม่มี Soft ค้าง — หยุด";
        stop = true;
      }
      if (noImprove > 0) seed = forkSeed(seed, r);
      algorithm = "ga";
    } else {
      const top = topIssue(ds, v.violations);
      const oldSeed = seed;
      seed = forkSeed(seed, r);
      ga = { ...ga, mutationRate: Math.min(0.6, Math.round((ga.mutationRate + 0.1) * 100) / 100) };
      if (noImprove > 0) ga = { ...ga, populationSize: Math.min(120, ga.populationSize + 10) };
      timeFactor = Math.min(3, timeFactor * 1.5);
      decision = `ยังมี Hard ${v.score.hard} รายการ (มากสุด: ${top}) — เปลี่ยน seed ${oldSeed}→${seed}, เพิ่ม mutation เป็น ${ga.mutationRate}${noImprove > 0 ? `, ขยายประชากรเป็น ${ga.populationSize}` : ""}, เพิ่มเวลารอบถัดไป 50% และใช้ GA`;
      algorithm = "ga";
    }
    if (!stop && r === maxRounds) decision += " — ครบจำนวนรอบสูงสุดแล้ว";
    if (!stop && ctl.timeUp()) decision += " — หมดเวลารวมแล้ว";
    rounds.push({
      round: r,
      algorithm: used.algorithm,
      seed: used.seed,
      timeLimitMs: Math.round(roundTime),
      weights: used.weights,
      ga: used.algorithm === "ga" ? used.ga : undefined,
      durationMs: Math.round(now() - t),
      hard: v.score.hard,
      soft: v.score.soft,
      status: v.score.hard === 0 ? "feasible" : res.stopped === "time" ? "timeout" : "partial",
      decision,
    });
    log.push(`Agent รอบ ${r} (${used.algorithm}, seed ${used.seed}): hard ${v.score.hard}, soft ${fmt(v.score.soft)} — ${decision}`);
    if (stop) break;
    if (ctl.timeUp()) {
      timedOut = true;
      break;
    }
  }
  if (!best) {
    // ไม่มีรอบใดได้รัน (หมดเวลา/ยกเลิกทันที)
    const res = await runCore(m, { algorithm: "heuristic", seed: x.seed, weights, ga: x.ga }, ctl.child(now() + 1));
    best = { placements: res.placements, score: validate(ds, res.placements, weights).score, violations: [] };
  }
  return finalize({ ds, algorithm: "agent", seed: x.seed, placements: best.placements, proofs, weights, cancelled, timedOut: timedOut || best.score.hard > 0, iterations, t0, history, log, agentRounds: rounds });
}

function fmt(x: number): string {
  return String(Math.round(x * 100) / 100);
}

function topIssue(ds: Dataset, vs: Violation[]): string {
  const cnt = new Map<string, number>();
  for (const v of vs) if (v.severity === "hard") cnt.set(v.type, (cnt.get(v.type) ?? 0) + 1);
  const [type, n] = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["-", 0];
  const ent = new Map<string, number>();
  for (const v of vs)
    if (v.severity === "hard" && v.type === type)
      for (const e of v.entities) if (e.kind === "teacher" || e.kind === "group" || e.kind === "room") ent.set(`${e.kind}:${e.id}`, (ent.get(`${e.kind}:${e.id}`) ?? 0) + 1);
  const top = [...ent.entries()].sort((a, b) => b[1] - a[1])[0];
  let who = "";
  if (top) {
    const [kind, id] = top[0].split(":");
    who =
      kind === "teacher"
        ? ds.teachers.find((t) => t.id === id)?.code ?? id
        : kind === "group"
          ? ds.groups.find((g) => g.id === id)?.code ?? id
          : ds.rooms.find((r) => r.id === id)?.code ?? id;
  }
  return `${type} ${n} รายการ${who ? ` เกี่ยวข้องกับ ${who} มากสุด` : ""}`;
}
