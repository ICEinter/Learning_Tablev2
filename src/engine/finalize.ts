/**
 * สรุปผล: ตรวจด้วย validator อิสระ → กำหนดสถานะ → คำอธิบาย
 */
import type { Dataset, Placement } from "@/shared/types";
import { sampleHistory } from "./core";
import { now } from "./ctl";
import { explain } from "./explain";
import type { AgentRoundLog, Algorithm, InfeasibilityProof, SolverResult, SolverStatus, Weights } from "./types";
import { validate } from "./validator";

export interface FinalizeInput {
  ds: Dataset;
  algorithm: Algorithm;
  seed: number;
  placements: Placement[];
  proofs: InfeasibilityProof[];
  weights: Weights;
  cancelled: boolean;
  timedOut: boolean;
  iterations: number;
  t0: number;
  history: { t: number; hard: number; soft: number }[];
  log: string[];
  agentRounds?: AgentRoundLog[];
}

export function finalize(x: FinalizeInput): SolverResult {
  const v = validate(x.ds, x.placements, x.weights);
  let status: SolverStatus;
  if (x.cancelled) status = "cancelled";
  else if (v.score.hard === 0) status = "feasible";
  else if (x.proofs.length) status = "infeasible-proven";
  else status = x.timedOut ? "timeout" : "partial";
  const elapsedMs = Math.round(now() - x.t0);
  x.log.push(`ตรวจผลด้วย validator อิสระ: hard ${v.score.hard}, soft ${Math.round(v.score.soft * 100) / 100} → ${status}`);
  return {
    status,
    placements: x.placements,
    score: v.score,
    violations: v.violations,
    proofs: x.proofs,
    stats: { algorithm: x.algorithm, seed: x.seed, iterations: x.iterations, elapsedMs, bestHistory: sampleHistory(x.history, 200) },
    log: x.log,
    agentRounds: x.agentRounds,
    explanation: [
      ...explain(x.ds, status, v.score, v.violations, x.proofs, x.weights),
      ...(x.agentRounds?.length
        ? [`Agent ทำงาน ${x.agentRounds.length} รอบ (ปรับเฉพาะ seed/เวลา/พารามิเตอร์ GA/น้ำหนัก Soft ไม่ผ่อน Hard และไม่แก้ข้อมูล): ${x.agentRounds.map((r) => `รอบ ${r.round} ${r.algorithm} hard ${r.hard} soft ${Math.round(r.soft * 100) / 100}`).join("; ")}`]
        : []),
    ],
  };
}

