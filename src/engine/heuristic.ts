/**
 * Heuristic baseline: DSatur-style most-constrained-first + best-fit room + ejection chain (มี tabu)
 * ตามด้วย min-conflicts repair แบบจำกัดรอบ
 * ทุกการสุ่มมาจาก rng ที่กำหนด seed → seed เดียวกันได้ผลเดียวกัน (ไม่มีการตัดสินใจตามเวลา
 * ยกเว้นเมื่อถูกยกเลิกหรือเกิน deadline ซึ่งเป็นทางหนีฉุกเฉิน)
 */
import type { Placement } from "@/shared/types";
import type { Ctl } from "./ctl";
import type { Model } from "./model";
import type { Rng } from "./rng";
import { HARD, State } from "./state";
import type { Weights } from "./types";

export interface HeuristicResult {
  state: State;
  iterations: number;
  aborted: boolean;
}

export async function runHeuristic(
  m: Model,
  w: Weights,
  rng: Rng,
  ctl: Ctl,
  opts: { initial?: Placement[]; maxBacktracksPerBlock?: number; repairIters?: number; onStep?: (it: number, st: State) => void } = {},
): Promise<HeuristicResult> {
  const st = new State(m, w);
  const B = m.blocks.length;
  const S = m.S;
  const owner = new Int32Array(m.E * S).fill(-1);
  const setOwner = (b: number, val: number) => {
    const s = st.start[b];
    const bl = m.blocks[b];
    for (const e of bl.ents) for (let k = 0; k < bl.len; k++) owner[e * S + s + k] = val;
    const r = st.room[b];
    if (r >= 0 && m.exclusive[m.roomOffset + r]) for (let k = 0; k < bl.len; k++) owner[(m.roomOffset + r) * S + s + k] = val;
  };
  const doPlace = (b: number, s: number, r: number) => {
    st.place(b, s, r);
    setOwner(b, b);
  };
  const doUnplace = (b: number) => {
    setOwner(b, -1);
    st.unplace(b);
  };

  if (opts.initial && opts.initial.length) {
    st.loadPlacements(opts.initial);
    // ถอด block ที่ขัดแย้งออก เพื่อวางใหม่
    const placed = m.blocks.map((b) => b.id).filter((b) => st.start[b] >= 0);
    const keep: [number, number, number][] = [];
    for (const b of placed) keep.push([b, st.start[b], st.room[b]]);
    st.clear();
    for (const [b, s, r] of keep) if (st.isFree(b, s, r)) doPlace(b, s, r);
  }

  const rnd = new Float64Array(B);
  for (let b = 0; b < B; b++) rnd[b] = rng.next();
  const unplaced: number[] = [];
  for (let b = 0; b < B; b++) if (st.start[b] < 0) unplaced.push(b);

  const bestRoom = (b: number, s: number): number => {
    const bl = m.blocks[b];
    let best = -1;
    let bestScore = Infinity;
    for (const r of bl.rooms) {
      if (!st.roomFree(b, s, r)) continue;
      const room = m.rooms[r];
      let score = (room.capacity - bl.size) / Math.max(1, room.capacity);
      score += 0.02 * room.equipment.length;
      // ห้องเดิมของกลุ่มในคาบติดกัน
      if (bl.groupEnts.length) {
        const g = bl.groupEnts[0] - m.T;
        const p = s % m.P;
        const prev = p > 0 ? st.roomSum[g * S + s - 1] : 0;
        const next = p + bl.len < m.P ? st.roomSum[g * S + s + bl.len] : 0;
        if (prev === r + 1 || next === r + 1) score -= 0.5;
      }
      score += rnd[b] * 1e-6 * r;
      if (score < bestScore) {
        bestScore = score;
        best = r;
      }
    }
    return best;
  };

  const countOptions = (b: number): number => {
    const bl = m.blocks[b];
    let n = 0;
    for (const s of bl.starts) {
      if (!st.isFree(b, s, -1)) continue;
      for (const r of bl.rooms)
        if (st.roomFree(b, s, r)) {
          n++;
          break;
        }
    }
    return n;
  };

  const opts0 = new Int32Array(B);
  for (const b of unplaced) opts0[b] = countOptions(b);
  const inUnplaced = new Uint8Array(B);
  for (const b of unplaced) inUnplaced[b] = 1;
  const refresh = (b: number) => {
    for (const e of m.blocks[b].ents) for (const x of m.entBlocks[e]) if (inUnplaced[x]) opts0[x] = countOptions(x);
  };

  const ejectCount = new Int32Array(B);
  const lastEjector = new Int32Array(B).fill(-1);
  const ejectStamp = new Int32Array(B);
  const maxBack = (opts.maxBacktracksPerBlock ?? 50) * B;
  let backtracks = 0;
  let it = 0;
  let aborted = false;
  const TENURE = 12;

  while (unplaced.length) {
    it++;
    if ((it & 15) === 0) {
      if (ctl.shouldStop()) {
        aborted = true;
        break;
      }
      await ctl.maybeYield();
      opts.onStep?.(it, st);
    }
    // เลือก block ที่มีทางเลือกน้อยสุด
    let bi = 0;
    for (let i = 1; i < unplaced.length; i++) {
      const x = unplaced[i];
      const y = unplaced[bi];
      const bx = m.blocks[x];
      const by = m.blocks[y];
      if (
        opts0[x] < opts0[y] ||
        (opts0[x] === opts0[y] &&
          (bx.len * bx.degree > by.len * by.degree || (bx.len * bx.degree === by.len * by.degree && rnd[x] < rnd[y])))
      )
        bi = i;
    }
    const b = unplaced[bi];
    const bl = m.blocks[b];
    // หาตำแหน่งว่างที่เพิ่ม soft น้อยสุด
    let bestS = -1;
    let bestR = -1;
    let bestC = Infinity;
    for (const s of bl.starts) {
      if (!st.isFree(b, s, -1)) continue;
      const r = bestRoom(b, s);
      if (r < 0) continue;
      const c = st.moveDelta(b, s, r) + rng.next() * 1e-3;
      if (c < bestC) {
        bestC = c;
        bestS = s;
        bestR = r;
      }
    }
    const removeFromUnplaced = () => {
      unplaced[bi] = unplaced[unplaced.length - 1];
      unplaced.pop();
      inUnplaced[b] = 0;
    };
    if (bestS >= 0) {
      removeFromUnplaced();
      doPlace(b, bestS, bestR);
      refresh(b);
      continue;
    }
    if (backtracks < maxBack) {
      // ejection chain: ถอด block ที่ขัดแย้ง "ถูกที่สุด"
      let pick: { s: number; r: number; victims: number[] } | null = null;
      let pickCost = Infinity;
      for (const s of bl.starts) {
        let ok = true;
        for (let k = 0; k < bl.len && ok; k++) if (!m.gridOk[s + k]) ok = false;
        for (const e of bl.ents) for (let k = 0; k < bl.len && ok; k++) if (m.blocked[e * S + s + k]) ok = false;
        if (!ok) continue;
        const base = new Set<number>();
        for (const e of bl.ents)
          for (let k = 0; k < bl.len; k++) {
            const o = owner[e * S + s + k];
            if (o >= 0) base.add(o);
          }
        // ครูเกิน maxPerDay หลังถอด → ข้าม
        if (bl.teacher >= 0) {
          const d = Math.floor(s / m.P);
          let load = st.dayLoad[bl.teacher * m.D + d] + bl.len;
          for (const v of base) if (m.blocks[v].teacher === bl.teacher) load -= m.blocks[v].len;
          if (load > m.maxPerDay[bl.teacher]) continue;
        }
        for (const r of bl.rooms) {
          if (!bl.roomOk[r]) continue;
          const re = m.roomOffset + r;
          let rb = false;
          for (let k = 0; k < bl.len; k++) if (m.blocked[re * S + s + k]) rb = true;
          if (rb) continue;
          const victims = new Set(base);
          if (m.exclusive[re])
            for (let k = 0; k < bl.len; k++) {
              const o = owner[re * S + s + k];
              if (o >= 0) victims.add(o);
            }
          let cost = 0;
          let tabu = false;
          for (const v of victims) {
            if (lastEjector[v] === b && it - ejectStamp[v] < TENURE) tabu = true;
            cost += 1 + ejectCount[v] + 0.1 * m.blocks[v].len;
          }
          if (tabu) continue;
          cost += rng.next() * 0.5;
          if (cost < pickCost) {
            pickCost = cost;
            pick = { s, r, victims: [...victims] };
          }
        }
      }
      if (pick) {
        backtracks++;
        removeFromUnplaced();
        for (const v of pick.victims) {
          doUnplace(v);
          ejectCount[v]++;
          lastEjector[v] = b;
          ejectStamp[v] = it;
          unplaced.push(v);
          inUnplaced[v] = 1;
        }
        doPlace(b, pick.s, pick.r);
        for (const v of pick.victims) {
          opts0[v] = countOptions(v);
          refresh(v);
        }
        refresh(b);
        continue;
      }
    }
    // บังคับวางที่ตำแหน่ง hard น้อยสุด (จะเหลือข้อขัดแย้ง)
    removeFromUnplaced();
    forcePlace(st, b, rng);
    setOwner(b, b);
    refresh(b);
  }
  // ถ้าถูกยกเลิกกลางทาง วางที่เหลือแบบเร็ว
  for (const b of unplaced) {
    const bl = m.blocks[b];
    st.place(b, bl.starts[rng.int(bl.starts.length)], bl.rooms[rng.int(bl.rooms.length)]);
  }
  if (!aborted) {
    st.fullCost();
    if (st.lastHard > 0) {
      const iters = opts.repairIters ?? Math.min(20000, 40 * B);
      await minConflicts(st, rng, iters, ctl);
    }
  }
  return { state: st, iterations: it, aborted };
}

function forcePlace(st: State, b: number, rng: Rng): void {
  const bl = st.m.blocks[b];
  let best = Infinity;
  let bs = bl.starts[0];
  let br = bl.rooms[0];
  for (const s of bl.starts)
    for (const r of bl.rooms) {
      const c = st.moveDelta(b, s, r) + rng.next() * 1e-3;
      if (c < best) {
        best = c;
        bs = s;
        br = r;
      }
    }
  st.place(b, bs, br);
}

/** ตัวเลือกห้องสำหรับ start s: ห้องว่างที่ตรงเงื่อนไขห้องแรก ไม่เช่นนั้นสุ่ม */
export function roomFor(st: State, b: number, s: number, rng: Rng): number {
  const bl = st.m.blocks[b];
  const n = bl.rooms.length;
  const off = rng.int(n);
  for (let i = 0; i < n; i++) {
    const r = bl.rooms[(i + off) % n];
    if (st.roomFree(b, s, r)) return r;
  }
  const cur = st.room[b];
  if (cur >= 0 && bl.roomOk[cur]) return cur;
  return bl.rooms[off];
}

/**
 * Min-conflicts repair: เลือก block ที่ละเมิด ย้ายไปตำแหน่งที่ต้นทุนรวมน้อยสุด (มี tabu และสุ่มเล็กน้อย)
 * คืนจำนวนรอบที่ใช้
 */
export async function minConflicts(st: State, rng: Rng, maxIters: number, ctl: Ctl | null): Promise<number> {
  const m = st.m;
  const B = m.blocks.length;
  const tabu = new Map<number, number>();
  let conflicted: number[] = [];
  const rebuild = () => {
    conflicted = [];
    for (let b = 0; b < B; b++) if (st.blockConflicts(b) > 0) conflicted.push(b);
  };
  rebuild();
  let it = 0;
  for (; it < maxIters && conflicted.length; it++) {
    if ((it & 31) === 0 && ctl) {
      if (ctl.shouldStop()) break;
      await ctl.maybeYield();
    }
    if (it % 25 === 0) rebuild();
    if (!conflicted.length) break;
    const b = conflicted[rng.int(conflicted.length)];
    if (st.blockConflicts(b) === 0) {
      rebuild();
      continue;
    }
    const bl = m.blocks[b];
    const cur = st.start[b];
    let bestD = Infinity;
    let bs = -1;
    let br = -1;
    const nS = bl.starts.length;
    const step = nS > 80 ? Math.ceil(nS / 80) : 1;
    const off = step > 1 ? rng.int(step) : 0;
    for (let i = off; i < nS; i += step) {
      const s = bl.starts[i];
      const r = s === cur ? altRoom(st, b, s, rng) : roomFor(st, b, s, rng);
      if (s === cur && r === st.room[b]) continue;
      const key = b * m.S + s;
      const tb = tabu.get(key);
      const d = st.moveDelta(b, s, r);
      if (tb !== undefined && tb > it && d > -HARD / 2) continue;
      const dd = d + rng.next() * 1e-3;
      if (dd < bestD) {
        bestD = dd;
        bs = s;
        br = r;
      }
    }
    if (bs < 0) continue;
    // ยอมรับแม้แย่ลงเล็กน้อย (หนีจุดติด) ด้วยความน่าจะเป็นต่ำ
    if (bestD <= 0 || rng.next() < 0.2) {
      tabu.set(b * m.S + cur, it + 10 + rng.int(10));
      st.move(b, bs, br);
    }
  }
  return it;
}

function altRoom(st: State, b: number, s: number, rng: Rng): number {
  const bl = st.m.blocks[b];
  const n = bl.rooms.length;
  const off = rng.int(n);
  for (let i = 0; i < n; i++) {
    const r = bl.rooms[(i + off) % n];
    if (r !== st.room[b] && st.roomFree(b, s, r)) return r;
  }
  return st.room[b];
}

/** Local search ปรับ Soft: ย้าย/สลับ block โดยไม่เพิ่ม hard (ยอมรับเมื่อ delta ≤ 0) */
export function improve(st: State, rng: Rng, iters: number, focus?: number[]): number {
  const m = st.m;
  const B = m.blocks.length;
  if (!B) return 0;
  let gained = 0;
  for (let i = 0; i < iters; i++) {
    const b = focus && focus.length && rng.next() < 0.5 ? focus[rng.int(focus.length)] : rng.int(B);
    const bl = m.blocks[b];
    if (rng.next() < 0.7 || B < 2) {
      const s = bl.starts[rng.int(bl.starts.length)];
      const r = roomFor(st, b, s, rng);
      if (s === st.start[b] && r === st.room[b]) continue;
      const d = st.moveDelta(b, s, r);
      if (d <= 0) {
        st.move(b, s, r);
        gained -= d;
      }
    } else {
      // สลับกับ block ความยาวเท่ากันที่ใช้ entity ร่วม
      const e = bl.ents[rng.int(bl.ents.length)];
      if (e === undefined) continue;
      const list = m.entBlocks[e];
      const o = list[rng.int(list.length)];
      if (o === b || m.blocks[o].len !== bl.len) continue;
      if (!inDomain(m.blocks[o].starts, st.start[b]) || !inDomain(bl.starts, st.start[o])) continue;
      const d = st.swapDelta(b, o, false);
      if (d <= 0) {
        st.swapDelta(b, o, true);
        gained -= d;
      }
    }
  }
  return gained;
}

export function inDomain(starts: Int32Array, s: number): boolean {
  // starts เรียงจากน้อยไปมาก → binary search
  let lo = 0;
  let hi = starts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = starts[mid];
    if (v === s) return true;
    if (v < s) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}
