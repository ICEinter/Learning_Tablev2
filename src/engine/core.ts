/**
 * ตัวรัน solver หนึ่งครั้ง (heuristic หรือ GA) — ใช้ร่วมกันโดย solve() และ agent
 */
import type { Placement } from "@/shared/types";
import type { Ctl } from "./ctl";
import { runGA, type Individual } from "./ga";
import { runHeuristic } from "./heuristic";
import { runTabuSearch } from "./tabu";
import type { Model } from "./model";
import { createRng } from "./rng";
import { State } from "./state";
import type { GAOptions, Weights } from "./types";

export interface CoreParams {
  algorithm: "heuristic" | "ga" | "tabu";
  seed: number;
  weights: Weights;
  ga: GAOptions;
  maxIterations?: number;
  initial?: Placement[];
  round?: number;
}

export interface CoreResult {
  placements: Placement[];
  iterations: number;
  history: { t: number; hard: number; soft: number }[];
  stopped: "done" | "time" | "cancelled";
  internalHard: number;
  internalSoft: number;
}

export async function runCore(m: Model, p: CoreParams, ctl: Ctl): Promise<CoreResult> {
  const rng = createRng(p.seed);
  const history: CoreResult["history"] = [];
  const phase = p.algorithm === "ga" ? "ga" : p.algorithm === "tabu" ? "tabu" : "heuristic";
  const report = (iteration: number, hard: number, soft: number, force = false, message?: string) =>
    ctl.progress({ phase, round: p.round, iteration, bestHard: hard, bestSoft: soft, message }, force);

  const h = await runHeuristic(m, p.weights, rng.fork("heuristic"), ctl, {
    initial: p.initial,
    onStep: (it) => report(it, -1, -1, false, "กำลังวางคาบ (heuristic)"),
  });
  h.state.fullCost();
  history.push({ t: Math.round(ctl.elapsed()), hard: h.state.lastHard, soft: h.state.lastSoft });
  report(h.iterations, h.state.lastHard, h.state.lastSoft, true, "heuristic เสร็จ");

  const stoppedOf = (): CoreResult["stopped"] => (ctl.cancelled ? "cancelled" : ctl.timeUp() ? "time" : "done");
  if (p.algorithm === "heuristic" || h.aborted || m.blocks.length === 0) {
    return {
      placements: h.state.toPlacements(),
      iterations: h.iterations,
      history,
      stopped: h.aborted ? stoppedOf() : "done",
      internalHard: h.state.lastHard,
      internalSoft: h.state.lastSoft,
    };
  }

  if (p.algorithm === "tabu") {
    const tabuRes = await runTabuSearch(
      m,
      p.weights,
      h.state,
      rng.fork("tabu"),
      ctl,
      { maxIterations: p.maxIterations },
      (it, hard, soft) => report(it, hard, soft, false, "กำลังค้นหาด้วย Tabu Search"),
    );
    history.push(...tabuRes.history);
    report(tabuRes.iterations, tabuRes.state.lastHard, tabuRes.state.lastSoft, true, "Tabu Search เสร็จ");
    return {
      placements: tabuRes.state.toPlacements(),
      iterations: tabuRes.iterations,
      history,
      stopped: tabuRes.aborted ? stoppedOf() : "done",
      internalHard: tabuRes.state.lastHard,
      internalSoft: tabuRes.state.lastSoft,
    };
  }

  // ---- GA: ประชากรเริ่มจาก heuristic + heuristic ที่ fork seed (สูงสุด ~50% ภายใน 30% ของเวลา) + สุ่ม+repair
  const seeds: Individual[] = [toInd(h.state)];
  const nFork = Math.max(1, Math.floor(p.ga.populationSize * 0.5));
  const budget = ctl.deadline - (ctl.t0 + ctl.elapsed());
  const forkStart = ctl.elapsed();
  for (let i = 1; i <= nFork; i++) {
    if (ctl.shouldStop() || ctl.elapsed() - forkStart > budget * 0.3) break;
    const r = await runHeuristic(m, p.weights, rng.fork(`heuristic-${i}`), ctl, {});
    if (r.aborted) break;
    seeds.push(toInd(r.state));
  }
  const res = await runGA(m, p.weights, p.ga, rng.fork("ga"), ctl, seeds, {
    maxGenerations: p.maxIterations,
    onGeneration: (gen, best) => {
      const last = history[history.length - 1];
      if (!last || best.hard < last.hard || (best.hard === last.hard && best.soft < last.soft))
        history.push({ t: Math.round(ctl.elapsed()), hard: best.hard, soft: best.soft });
      report(gen, best.hard, best.soft);
    },
  });
  const st = new State(m, p.weights);
  st.load(res.best.start, res.best.room);
  st.fullCost();
  report(res.generations, st.lastHard, st.lastSoft, true, "GA เสร็จ");
  return {
    placements: st.toPlacements(),
    iterations: res.generations,
    history,
    stopped: res.stopReason === "cancelled" ? "cancelled" : res.stopReason === "time" ? "time" : "done",
    internalHard: st.lastHard,
    internalSoft: st.lastSoft,
  };
}

function toInd(st: State): Individual {
  const cost = st.fullCost();
  return { start: st.start.slice(), room: st.room.slice(), cost, hard: st.lastHard, soft: st.lastSoft, hash: 0 };
}

export function sampleHistory<T>(arr: T[], max = 200): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (max - 1))]);
  return out;
}
