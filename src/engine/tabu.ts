/**
 * Conflict-Driven Tabu Search: Local Search ที่เน้นการแก้ Hard Conflicts เฉพาะจุดในระดับเสี้ยววินาที
 * - ตรวจหาเฉพาะ block ที่มีข้อขัดแย้ง (conflicted blocks)
 * - สุ่มและประเมิน candidate moves เฉพาะจุด
 * - มี Tabu List ป้องกันการย้ายซ้ำไปตำแหน่งเดิมภายในช่วง Tabu Tenure
 * - มี Aspiration Criterion: หากการย้ายใดให้ผลลัพธ์ดีที่สุดเท่าที่เคยพบ (All-time best) จะอนุญาตแม้ติด Tabu
 */
import type { Ctl } from "./ctl";
import type { Model } from "./model";
import type { Rng } from "./rng";
import { HARD, State } from "./state";
import type { Weights } from "./types";

export interface TabuOptions {
  tabuTenure?: number;
  maxIterations?: number;
  candidatesPerStep?: number;
}

export interface TabuResult {
  state: State;
  iterations: number;
  aborted: boolean;
  history: { t: number; hard: number; soft: number }[];
}

export async function runTabuSearch(
  m: Model,
  w: Weights,
  initialState: State,
  rng: Rng,
  ctl: Ctl,
  opts: TabuOptions = {},
  onProgress?: (it: number, hard: number, soft: number) => void,
): Promise<TabuResult> {
  const tenure = opts.tabuTenure ?? 12;
  const maxIters = opts.maxIterations ?? 2000;
  const numCandidates = opts.candidatesPerStep ?? 30;

  const st = new State(m, w);
  // คัดลอกตำแหน่งจาก initialState
  for (let b = 0; b < m.blocks.length; b++) {
    const s = initialState.start[b];
    const r = initialState.room[b];
    if (s >= 0 && r >= 0) st.place(b, s, r);
  }
  st.fullCost();

  // บันทึก Best-so-far
  let bestHard = st.lastHard;
  let bestSoft = st.lastSoft;
  const bestStart = new Int32Array(st.start);
  const bestRoom = new Int32Array(st.room);

  const history: TabuResult["history"] = [
    { t: Math.round(ctl.elapsed()), hard: bestHard, soft: bestSoft },
  ];

  // Tabu table: hash(b, slot) -> expireIteration
  const tabuList = new Map<string, number>();

  let iter = 0;

  while (iter < maxIters && !ctl.shouldStop()) {
    iter++;

    // หากแก้ Hard = 0 สำเร็จแล้ว ให้หยุด
    if (st.lastHard === 0) {
      break;
    }

    // 1. หา blocks ที่กำลังชน (conflicted blocks)
    const conflictedBlocks: number[] = [];
    for (let b = 0; b < m.blocks.length; b++) {
      const s = st.start[b];
      const bl = m.blocks[b];
      let hasConflict = false;
      if (s < 0) {
        conflictedBlocks.push(b);
        continue;
      }
      for (const e of bl.ents) {
        for (let k = 0; k < bl.len; k++) {
          const idx = e * m.S + s + k;
          if (st.occ[idx] > 1 || m.blocked[idx]) {
            hasConflict = true;
            break;
          }
        }
        if (hasConflict) break;
      }
      if (!hasConflict && st.room[b] >= 0) {
        const re = m.roomOffset + st.room[b];
        if (m.exclusive[re]) {
          for (let k = 0; k < bl.len; k++) {
            const idx = re * m.S + s + k;
            if (st.occ[idx] > 1 || m.blocked[idx]) {
              hasConflict = true;
              break;
            }
          }
        }
      }
      if (hasConflict) conflictedBlocks.push(b);
    }

    if (conflictedBlocks.length === 0) {
      break;
    }

    // 2. ประเมินชุด Candidate Moves สำหรับ block ที่ชน
    interface MoveCandidate {
      b: number;
      newS: number;
      newR: number;
      deltaCost: number;
      isTabu: boolean;
    }

    let bestMove: MoveCandidate | null = null;

    for (let c = 0; c < numCandidates; c++) {
      const b = conflictedBlocks[rng.int(conflictedBlocks.length)];
      const bl = m.blocks[b];
      if (bl.starts.length === 0 || bl.rooms.length === 0) continue;

      const newS = bl.starts[rng.int(bl.starts.length)];
      const newR = bl.rooms[rng.int(bl.rooms.length)];

      if (newS === st.start[b] && newR === st.room[b]) continue;

      const delta = st.moveDelta(b, newS, newR);
      const moveKey = `${b}:${newS}`;
      const tabuUntil = tabuList.get(moveKey) ?? 0;
      const isTabu = tabuUntil > iter;

      const currCost = st.lastHard * HARD + st.lastSoft;
      const targetCost = currCost + delta;
      const bestCost = bestHard * HARD + bestSoft;
      const satisfiesAspiration = targetCost < bestCost;

      if (!isTabu || satisfiesAspiration) {
        if (!bestMove || delta < bestMove.deltaCost) {
          bestMove = { b, newS, newR, deltaCost: delta, isTabu };
        }
      }
    }

    // 3. ถ้าพบ Move ให้ดำเนินการ
    if (bestMove) {
      const oldS = st.start[bestMove.b];
      if (oldS >= 0) {
        tabuList.set(`${bestMove.b}:${oldS}`, iter + tenure);
      }
      st.move(bestMove.b, bestMove.newS, bestMove.newR);

      const currentCost = st.lastHard * HARD + st.lastSoft;
      const bestCost = bestHard * HARD + bestSoft;
      if (currentCost < bestCost) {
        bestHard = st.lastHard;
        bestSoft = st.lastSoft;
        bestStart.set(st.start);
        bestRoom.set(st.room);
        history.push({ t: Math.round(ctl.elapsed()), hard: bestHard, soft: bestSoft });
      }
    } else {
      // Perturbation
      const b = conflictedBlocks[rng.int(conflictedBlocks.length)];
      const bl = m.blocks[b];
      if (bl.starts.length > 0 && bl.rooms.length > 0) {
        const newS = bl.starts[rng.int(bl.starts.length)];
        const newR = bl.rooms[rng.int(bl.rooms.length)];
        st.move(b, newS, newR);
      }
    }

    if (iter % 15 === 0) {
      if (onProgress) onProgress(iter, bestHard, bestSoft);
      await ctl.maybeYield();
    }
  }

  // โหลดตำแหน่งที่ดีที่สุดกลับเข้า State
  st.clear();
  for (let b = 0; b < m.blocks.length; b++) {
    if (bestStart[b] >= 0 && bestRoom[b] >= 0) {
      st.place(b, bestStart[b], bestRoom[b]);
    }
  }
  st.fullCost();

  return {
    state: st,
    iterations: iter,
    aborted: ctl.shouldStop(),
    history,
  };
}
