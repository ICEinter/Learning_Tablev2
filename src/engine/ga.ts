/**
 * Genetic Algorithm (memetic)
 * - Encoding: ต่อ block {start ∈ domain, room ∈ ห้องที่ตรงเงื่อนไข} → BLOCK_SPLIT/BREAK/ห้องผิดประเภท เป็นจริงโดยโครงสร้าง
 * - Fitness: hard × 1e9 + Σ wᵢ·softᵢ ประเมินด้วย occupancy arrays (State)
 * - Selection: tournament; Crossover: แบบยกกลุ่ม/ครู และแบบรายวัน; Mutation: เอนเอียงไป block ที่ละเมิด
 * - Repair: min-conflicts จำกัดรอบ; Local search ปรับ soft; Elitism + ตัดตัวซ้ำด้วย hash
 * - หยุด: เวลา / maxIterations (จำนวนรุ่น) / ไม่ดีขึ้น stallGenerations รุ่น / hard=0 และ soft=0 / ยกเลิก
 */
import type { Ctl } from "./ctl";
import { improve, inDomain, minConflicts, roomFor } from "./heuristic";
import type { Model } from "./model";
import type { Rng } from "./rng";
import { State } from "./state";
import type { GAOptions, Weights } from "./types";

export interface Individual {
  start: Int32Array;
  room: Int32Array;
  cost: number;
  hard: number;
  soft: number;
  hash: number;
}

export interface GAResult {
  best: Individual;
  generations: number;
  stopReason: "time" | "iterations" | "stall" | "optimal" | "cancelled";
}

function hashGenes(start: Int32Array, room: Int32Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < start.length; i++) {
    h ^= start[i];
    h = Math.imul(h, 0x01000193);
    h ^= room[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function snapshot(st: State): Individual {
  const cost = st.fullCost();
  const start = st.start.slice();
  const room = st.room.slice();
  return { start, room, cost, hard: st.lastHard, soft: st.lastSoft, hash: hashGenes(start, room) };
}

export async function runGA(
  m: Model,
  w: Weights,
  ga: GAOptions,
  rng: Rng,
  ctl: Ctl,
  seeds: Individual[],
  opts: { maxGenerations?: number; onGeneration?: (gen: number, best: Individual) => void },
): Promise<GAResult> {
  const B = m.blocks.length;
  const st = new State(m, w);
  const N = Math.max(4, Math.floor(ga.populationSize));
  const elite = Math.min(N - 1, Math.max(1, Math.floor(ga.eliteCount)));
  const repairIters = Math.max(50, Math.min(2 * B, 1500));
  const childRepair = Math.max(20, Math.min(B >> 1, 100));
  const lsIters = Math.max(30, Math.min(Math.ceil(B / 2), 600));

  const evalSeed = (ind: Individual): Individual => {
    st.load(ind.start, ind.room);
    return snapshot(st);
  };

  // ---- ประชากรเริ่มต้น: seeds (heuristic) + สุ่มเต็มตัวแล้ว repair (≤ 2 ตัว ถ้ามีเวลา) + seed ที่ถูกรบกวนบางส่วนแล้ว repair
  const pop: Individual[] = seeds.slice(0, N).map(evalSeed);
  const initStart = ctl.elapsed();
  const budget = Math.max(1, ctl.deadline - ctl.t0 - initStart);
  let randomMade = 0;
  while (pop.length < N) {
    if (ctl.shouldStop() && pop.length >= 1) break;
    await ctl.maybeYield();
    const fullyRandom = randomMade < 2 && (pop.length === 0 || ctl.elapsed() - initStart < budget * 0.15);
    if (fullyRandom) {
      randomMade++;
      st.clear();
      for (let b = 0; b < B; b++) {
        const bl = m.blocks[b];
        const s = bl.starts[rng.int(bl.starts.length)];
        st.place(b, s, roomFor(st, b, s, rng));
      }
      await minConflicts(st, rng, repairIters, ctl);
    } else {
      const base = pop[rng.int(pop.length)];
      st.load(base.start, base.room);
      const k = Math.max(3, Math.ceil(B * 0.05));
      for (let i = 0; i < k; i++) {
        const b = rng.int(B);
        const bl = m.blocks[b];
        const s = bl.starts[rng.int(bl.starts.length)];
        st.move(b, s, roomFor(st, b, s, rng));
      }
      st.fullCost();
      if (st.lastHard > 0) await minConflicts(st, rng, childRepair, ctl);
    }
    improve(st, rng, lsIters);
    pop.push(snapshot(st));
  }
  const cmp = (a: Individual, b: Individual) => a.hard - b.hard || a.soft - b.soft;
  pop.sort(cmp);
  let best = pop[0];
  let stall = 0;
  let gen = 0;
  let stopReason: GAResult["stopReason"] = "iterations";
  const maxGen = opts.maxGenerations ?? Infinity;

  const tournament = (): Individual => {
    let b = pop[rng.int(pop.length)];
    for (let i = 1; i < ga.tournamentK; i++) {
      const c = pop[rng.int(pop.length)];
      if (cmp(c, b) < 0) b = c;
    }
    return b;
  };

  while (true) {
    if (ctl.cancelled) {
      stopReason = "cancelled";
      break;
    }
    if (ctl.timeUp()) {
      stopReason = "time";
      break;
    }
    if (gen >= maxGen) {
      stopReason = "iterations";
      break;
    }
    if (stall >= ga.stallGenerations) {
      stopReason = "stall";
      break;
    }
    if (best.hard === 0 && best.soft === 0) {
      stopReason = "optimal";
      break;
    }
    gen++;
    const next: Individual[] = pop.slice(0, elite);
    const seen = new Set(next.map((x) => x.hash));
    // memetic: ปรับ elite ตัวแรกด้วย local search เพิ่ม
    {
      st.load(next[0].start, next[0].room);
      if (st.fullCost() && st.lastHard > 0) await minConflicts(st, rng, repairIters, ctl);
      improve(st, rng, lsIters * 2);
      const e0 = snapshot(st);
      if (cmp(e0, next[0]) < 0 && !seen.has(e0.hash)) {
        next[0] = e0;
        seen.add(e0.hash);
      }
    }
    let aborted = false;
    while (next.length < N) {
      if (ctl.shouldStop()) {
        aborted = true;
        break;
      }
      await ctl.maybeYield();
      const p1 = tournament();
      const p2 = tournament();
      let cs: Int32Array;
      let cr: Int32Array;
      if (rng.next() < ga.crossoverRate && p1 !== p2) [cs, cr] = crossover(m, p1, p2, rng);
      else {
        cs = p1.start.slice();
        cr = p1.room.slice();
      }
      st.load(cs, cr);
      st.fullCost();
      if (rng.next() < ga.mutationRate) mutate(st, rng);
      st.fullCost();
      if (st.lastHard > 0) await minConflicts(st, rng, childRepair, ctl);
      improve(st, rng, lsIters);
      let child = snapshot(st);
      if (seen.has(child.hash)) {
        mutate(st, rng);
        if (st.fullCost() && st.lastHard > 0) await minConflicts(st, rng, childRepair >> 1, ctl);
        improve(st, rng, lsIters);
        child = snapshot(st);
        if (seen.has(child.hash)) continue;
      }
      seen.add(child.hash);
      next.push(child);
    }
    if (next.length >= 2 || !aborted) {
      // เติมด้วยประชากรเดิมถ้าถูกหยุดกลางรุ่น
      for (let i = elite; next.length < N && i < pop.length; i++) if (!seen.has(pop[i].hash)) next.push(pop[i]);
      pop.length = 0;
      pop.push(...next);
      pop.sort(cmp);
    }
    if (cmp(pop[0], best) < 0) {
      best = pop[0];
      stall = 0;
    } else stall++;
    opts.onGeneration?.(gen, best);
    if (aborted) {
      stopReason = ctl.cancelled ? "cancelled" : "time";
      break;
    }
  }
  return { best, generations: gen, stopReason };
}

function crossover(m: Model, p1: Individual, p2: Individual, rng: Rng): [Int32Array, Int32Array] {
  const B = m.blocks.length;
  const cs = p1.start.slice();
  const cr = p1.room.slice();
  const mode = rng.int(3);
  if (mode === 2) {
    // รายวัน: block ที่ p2 วางในวันที่สุ่มเลือก ใช้ยีนของ p2
    const days = new Uint8Array(m.D);
    for (let d = 0; d < m.D; d++) days[d] = rng.next() < 0.5 ? 1 : 0;
    for (let b = 0; b < B; b++)
      if (days[Math.floor(p2.start[b] / m.P)]) {
        cs[b] = p2.start[b];
        cr[b] = p2.room[b];
      }
  } else {
    // ยกทั้งกลุ่ม (mode 0) หรือทั้งครู (mode 1)
    const pickEnt = new Uint8Array(m.E);
    for (let e = 0; e < m.E; e++) pickEnt[e] = rng.next() < 0.5 ? 1 : 0;
    for (let b = 0; b < B; b++) {
      const bl = m.blocks[b];
      const key = mode === 0 ? bl.groupEnts[0] : bl.teacher;
      if (key !== undefined && key >= 0 && pickEnt[key]) {
        cs[b] = p2.start[b];
        cr[b] = p2.room[b];
      }
    }
  }
  return [cs, cr];
}

/** Mutation: ย้าย start / เปลี่ยนห้อง / สลับ 2 block / ย้ายทั้งวันของกลุ่ม — เอนเอียงไป block ที่ละเมิด */
function mutate(st: State, rng: Rng): void {
  const m = st.m;
  const B = m.blocks.length;
  if (!B) return;
  const conflicted: number[] = [];
  if (st.lastHard > 0) for (let b = 0; b < B; b++) if (st.blockConflicts(b) > 0) conflicted.push(b);
  const pickBlock = () => (conflicted.length && rng.next() < 0.8 ? conflicted[rng.int(conflicted.length)] : rng.int(B));
  const k = 1 + rng.int(3);
  for (let i = 0; i < k; i++) {
    const op = rng.int(10);
    const b = pickBlock();
    const bl = m.blocks[b];
    if (op < 5) {
      const s = bl.starts[rng.int(bl.starts.length)];
      st.move(b, s, roomFor(st, b, s, rng));
    } else if (op < 7) {
      const r = bl.rooms[rng.int(bl.rooms.length)];
      if (bl.roomOk[r]) st.move(b, st.start[b], r);
    } else if (op < 9) {
      const o = rng.int(B);
      if (o !== b && m.blocks[o].len === bl.len && inDomain(m.blocks[o].starts, st.start[b]) && inDomain(bl.starts, st.start[o])) st.swapDelta(b, o, true);
    } else if (bl.groupEnts.length) {
      // ย้ายทุก block ของกลุ่มในวันหนึ่งไปอีกวัน (คงคาบเดิม)
      const g = bl.groupEnts[0];
      const d1 = Math.floor(st.start[b] / m.P);
      const d2 = rng.int(m.D);
      if (d1 === d2 || !m.activeDay[d2]) continue;
      for (const x of m.entBlocks[g]) {
        const s = st.start[x];
        if (Math.floor(s / m.P) !== d1) continue;
        const ns = d2 * m.P + (s % m.P);
        if (inDomain(m.blocks[x].starts, ns)) st.move(x, ns, roomFor(st, x, ns, rng));
      }
    }
  }
}

export function individualFromState(st: State): Individual {
  return snapshot(st);
}
