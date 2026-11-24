/**
 * สถานะตาราง (occupancy arrays) + การประเมินต้นทุนแบบเฉพาะจุด (incremental)
 * cost = hardUnits × HARD + Σ wᵢ·softᵢ
 * hardUnits: Σ(occ−1) ที่ชน + การใช้ slot ต้องห้าม + ครูเกิน maxPerDay + คาบนอก grid + ห้องไม่ตรงเงื่อนไข + คาบที่ยังไม่ได้วาง
 * นิยาม Soft ตรงกับ validator.ts (มีชุดทดสอบเทียบ)
 */
import type { Placement } from "@/shared/types";
import type { Model } from "./model";
import { SOFT_KEYS, type SoftKey, type Weights } from "./types";

export const HARD = 1e9;

export type Breakdown = Record<SoftKey, number>;

export function emptyBreakdown(): Breakdown {
  return { teacherGaps: 0, studentGaps: 0, dayBalance: 0, roomChanges: 0, preferredTimes: 0, sameCourseSameDay: 0, lateHours: 0 };
}

export class State {
  readonly m: Model;
  w: Weights;
  start: Int32Array;
  room: Int32Array;
  occ: Int32Array;
  roomSum: Int32Array;
  dayLoad: Int32Array;
  aDay: Int32Array;
  // ผลของ localCost ล่าสุด
  lastHard = 0;
  lastSoft = 0;
  private bd: Breakdown = emptyBreakdown();
  private mark: Int32Array;
  private entMark: Int32Array;
  private epoch = 1;
  private keys: number[] = [];
  private entsTouched: number[] = [];

  constructor(m: Model, w: Weights) {
    this.m = m;
    this.w = w;
    const B = m.blocks.length;
    this.start = new Int32Array(B).fill(-1);
    this.room = new Int32Array(B).fill(-1);
    this.occ = new Int32Array(m.E * m.S);
    this.roomSum = new Int32Array(m.G * m.S);
    this.dayLoad = new Int32Array(m.E * m.D);
    this.aDay = new Int32Array(m.A * m.D);
    this.mark = new Int32Array(m.E * m.D);
    this.entMark = new Int32Array(m.E);
  }

  clear(): void {
    this.start.fill(-1);
    this.room.fill(-1);
    this.occ.fill(0);
    this.roomSum.fill(0);
    this.dayLoad.fill(0);
    this.aDay.fill(0);
  }

  load(start: Int32Array, room: Int32Array): void {
    this.clear();
    for (let b = 0; b < start.length; b++) if (start[b] >= 0) this.place(b, start[b], room[b]);
  }

  place(b: number, s: number, r: number): void {
    const m = this.m;
    const bl = m.blocks[b];
    const S = m.S;
    const d = Math.floor(s / m.P);
    this.start[b] = s;
    this.room[b] = r;
    for (const e of bl.ents) {
      const base = e * S + s;
      for (let k = 0; k < bl.len; k++) this.occ[base + k]++;
      this.dayLoad[e * m.D + d] += bl.len;
    }
    if (r >= 0) {
      const e = m.roomOffset + r;
      const base = e * S + s;
      for (let k = 0; k < bl.len; k++) this.occ[base + k]++;
      this.dayLoad[e * m.D + d] += bl.len;
      for (const ge of bl.groupEnts) {
        const gb = (ge - m.T) * S + s;
        for (let k = 0; k < bl.len; k++) this.roomSum[gb + k] += r + 1;
      }
    }
    this.aDay[bl.a * m.D + d]++;
  }

  unplace(b: number): void {
    const s = this.start[b];
    if (s < 0) return;
    const m = this.m;
    const bl = m.blocks[b];
    const S = m.S;
    const d = Math.floor(s / m.P);
    const r = this.room[b];
    for (const e of bl.ents) {
      const base = e * S + s;
      for (let k = 0; k < bl.len; k++) this.occ[base + k]--;
      this.dayLoad[e * m.D + d] -= bl.len;
    }
    if (r >= 0) {
      const e = m.roomOffset + r;
      const base = e * S + s;
      for (let k = 0; k < bl.len; k++) this.occ[base + k]--;
      this.dayLoad[e * m.D + d] -= bl.len;
      for (const ge of bl.groupEnts) {
        const gb = (ge - m.T) * S + s;
        for (let k = 0; k < bl.len; k++) this.roomSum[gb + k] -= r + 1;
      }
    }
    this.aDay[bl.a * m.D + d]--;
    this.start[b] = -1;
    this.room[b] = -1;
  }

  // ---------- ส่วนประกอบต้นทุน ----------

  /** ต้นทุนของ entity e ในวัน d (hard → lastHard, soft → bd) */
  private entDay(e: number, d: number, bd: Breakdown): number {
    const m = this.m;
    const P = m.P;
    const S = m.S;
    const base = e * S + d * P;
    const occ = this.occ;
    let hard = 0;
    const excl = m.exclusive[e];
    for (let p = 0; p < P; p++) {
      const o = occ[base + p];
      if (o === 0) continue;
      if (excl && o > 1) hard += o - 1;
      if (m.blocked[base + p]) hard += o;
    }
    const kind = m.kind[e];
    const load = this.dayLoad[e * m.D + d];
    if (kind === 0) {
      const over = load - m.maxPerDay[e];
      if (over > 0) hard += over;
      if (load > 0) {
        bd.teacherGaps += this.gaps(base, e);
        const pb = e * S + d * P;
        for (let p = 0; p < P; p++) if (m.pref[pb + p]) bd.preferredTimes += occ[base + p];
      }
    } else if (kind === 1 && load > 0) {
      bd.studentGaps += this.gaps(base, e);
      const rb = (e - m.T) * S + d * P;
      let prev = -1;
      for (let p = 0; p < P; p++) {
        const o = occ[base + p];
        if (o === 0) continue;
        if (prev >= 0 && occ[base + prev] === 1 && o === 1 && this.roomSum[rb + prev] !== this.roomSum[rb + p]) bd.roomChanges++;
        prev = p;
      }
    }
    return hard;
  }

  private gaps(base: number, e: number): number {
    const m = this.m;
    const P = m.P;
    const lb = base; // lockedBusy ใช้ index เดียวกับ occ
    void e;
    let first = -1;
    let last = -1;
    for (let p = 0; p < P; p++)
      if (this.occ[base + p] > 0 || m.lockedBusy[lb + p]) {
        if (first < 0) first = p;
        last = p;
      }
    let g = 0;
    for (let p = first + 1; p < last; p++) if (this.occ[base + p] === 0 && !m.lockedBusy[lb + p] && !m.breakP[p]) g++;
    return g;
  }

  private balance(e: number): number {
    const m = this.m;
    if (m.kind[e] > 1 || m.nActive === 0) return 0;
    let mx = -Infinity;
    let mn = Infinity;
    let tot = 0;
    const b = e * m.D;
    for (let d = 0; d < m.D; d++) {
      if (!m.activeDay[d]) continue;
      const l = this.dayLoad[b + d];
      tot += l;
      if (l > mx) mx = l;
      if (l < mn) mn = l;
    }
    if (tot === 0) return 0;
    return Math.max(0, mx - mn - (tot % m.nActive === 0 ? 0 : 1));
  }

  private asgCost(a: number): number {
    const D = this.m.D;
    let x = 0;
    for (let d = 0; d < D; d++) {
      const c = this.aDay[a * D + d];
      if (c > 1) x += c - 1;
    }
    return x;
  }

  /** ต้นทุนของ block เอง: hard (นอก grid, ห้องไม่ตรง, ยังไม่วาง), soft (lateHours) */
  private blockOwn(b: number, bd: Breakdown): number {
    const m = this.m;
    const bl = m.blocks[b];
    const s = this.start[b];
    if (s < 0) return bl.len;
    let hard = 0;
    for (let k = 0; k < bl.len; k++) {
      if (!m.gridOk[s + k]) hard++;
      if (m.late[s + k]) bd.lateHours++;
    }
    const r = this.room[b];
    if (r < 0 || !bl.roomOk[r]) hard++;
    return hard;
  }

  private weighted(bd: Breakdown): number {
    let x = 0;
    for (const k of SOFT_KEYS) x += this.w[k] * bd[k];
    return x;
  }

  /** ต้นทุนรวมทั้งหมด (คำนวณใหม่ทั้งหมด) */
  fullCost(): number {
    const m = this.m;
    const bd = emptyBreakdown();
    let hard = 0;
    for (let e = 0; e < m.E; e++) {
      for (let d = 0; d < m.D; d++) hard += this.entDay(e, d, bd);
      bd.dayBalance += this.balance(e);
    }
    for (let a = 0; a < m.A; a++) bd.sameCourseSameDay += this.asgCost(a);
    for (let b = 0; b < m.blocks.length; b++) hard += this.blockOwn(b, bd);
    this.bd = bd;
    this.lastHard = hard;
    this.lastSoft = this.weighted(bd);
    return hard * HARD + this.lastSoft;
  }

  breakdown(): Breakdown {
    return { ...this.bd };
  }

  // ---------- local cost ----------
  /** เริ่มชุด (entity, day) ที่ได้รับผล */
  beginTouch(): void {
    this.epoch++;
    if (this.epoch > 2e9) {
      this.mark.fill(0);
      this.entMark.fill(0);
      this.epoch = 1;
    }
    this.keys.length = 0;
    this.entsTouched.length = 0;
  }

  /** เพิ่มผลกระทบของ block b เมื่ออยู่ที่ start s ห้อง r */
  touch(b: number, s: number, r: number): void {
    if (s < 0) return;
    const m = this.m;
    const d = Math.floor(s / m.P);
    const bl = m.blocks[b];
    for (const e of bl.ents) this.touchED(e, d);
    if (r >= 0) this.touchED(m.roomOffset + r, d);
  }

  private touchED(e: number, d: number): void {
    const k = e * this.m.D + d;
    if (this.mark[k] !== this.epoch) {
      this.mark[k] = this.epoch;
      this.keys.push(k);
    }
    if (this.entMark[e] !== this.epoch) {
      this.entMark[e] = this.epoch;
      this.entsTouched.push(e);
    }
  }

  /** ต้นทุนเฉพาะส่วนที่ touch ไว้ + assignments + blocks ที่ระบุ */
  localCost(asgs: number[], blocks: number[]): number {
    const bd = emptyBreakdown();
    const D = this.m.D;
    let hard = 0;
    for (const k of this.keys) hard += this.entDay(Math.floor(k / D), k % D, bd);
    for (const e of this.entsTouched) bd.dayBalance += this.balance(e);
    for (let i = 0; i < asgs.length; i++) {
      if (i > 0 && asgs.indexOf(asgs[i]) < i) continue;
      bd.sameCourseSameDay += this.asgCost(asgs[i]);
    }
    for (const b of blocks) hard += this.blockOwn(b, bd);
    this.lastHard = hard;
    this.lastSoft = this.weighted(bd);
    return hard * HARD + this.lastSoft;
  }

  /** delta ของการย้าย block b ไป (s, r) — ไม่เปลี่ยนสถานะ */
  moveDelta(b: number, s: number, r: number): number {
    const s0 = this.start[b];
    const r0 = this.room[b];
    const a = this.m.blocks[b].a;
    this.beginTouch();
    this.touch(b, s0, r0);
    this.touch(b, s, r);
    const before = this.localCost([a], [b]);
    if (s0 >= 0) this.unplace(b);
    this.place(b, s, r);
    const after = this.localCost([a], [b]);
    this.unplace(b);
    if (s0 >= 0) this.place(b, s0, r0);
    return after - before;
  }

  /** ย้ายจริง คืน delta */
  move(b: number, s: number, r: number): number {
    const s0 = this.start[b];
    const r0 = this.room[b];
    const a = this.m.blocks[b].a;
    this.beginTouch();
    this.touch(b, s0, r0);
    this.touch(b, s, r);
    const before = this.localCost([a], [b]);
    if (s0 >= 0) this.unplace(b);
    this.place(b, s, r);
    return this.localCost([a], [b]) - before;
  }

  /** delta ของการสลับตำแหน่ง block b1, b2 (ความยาวเท่ากัน) — ไม่เปลี่ยนสถานะ */
  swapDelta(b1: number, b2: number, apply: boolean): number {
    const s1 = this.start[b1];
    const r1 = this.room[b1];
    const s2 = this.start[b2];
    const r2 = this.room[b2];
    const m = this.m;
    const bl1 = m.blocks[b1];
    const bl2 = m.blocks[b2];
    const nr1 = bl1.roomOk[r2] ? r2 : r1;
    const nr2 = bl2.roomOk[r1] ? r1 : r2;
    this.beginTouch();
    this.touch(b1, s1, r1);
    this.touch(b2, s2, r2);
    this.touch(b1, s2, nr1);
    this.touch(b2, s1, nr2);
    const asgs = [bl1.a, bl2.a];
    const bls = [b1, b2];
    const before = this.localCost(asgs, bls);
    this.unplace(b1);
    this.unplace(b2);
    this.place(b1, s2, nr1);
    this.place(b2, s1, nr2);
    const delta = this.localCost(asgs, bls) - before;
    if (!apply) {
      this.unplace(b1);
      this.unplace(b2);
      this.place(b1, s1, r1);
      this.place(b2, s2, r2);
    }
    return delta;
  }

  /** hard units ที่เกี่ยวกับ block b ณ ตำแหน่งปัจจุบัน (ใช้เลือก block ที่ละเมิด) */
  blockConflicts(b: number): number {
    const s = this.start[b];
    const m = this.m;
    const bl = m.blocks[b];
    if (s < 0) return bl.len;
    let c = 0;
    const S = m.S;
    for (let k = 0; k < bl.len; k++) {
      for (const e of bl.ents) {
        const i = e * S + s + k;
        if (this.occ[i] > 1) c++;
        if (m.blocked[i]) c++;
      }
      const r = this.room[b];
      if (r >= 0) {
        const i = (m.roomOffset + r) * S + s + k;
        if (m.exclusive[m.roomOffset + r] && this.occ[i] > 1) c++;
        if (m.blocked[i]) c++;
      }
      if (!m.gridOk[s + k]) c++;
    }
    if (bl.teacher >= 0) {
      const d = Math.floor(s / m.P);
      if (this.dayLoad[bl.teacher * m.D + d] > m.maxPerDay[bl.teacher]) c++;
    }
    const r = this.room[b];
    if (r < 0 || !bl.roomOk[r]) c++;
    return c;
  }

  /** (s, r) ไม่ก่อ hard ใหม่หรือไม่ (block b ต้องยังไม่ถูกวาง) */
  isFree(b: number, s: number, r: number): boolean {
    const m = this.m;
    const bl = m.blocks[b];
    const S = m.S;
    for (let k = 0; k < bl.len; k++) {
      if (!m.gridOk[s + k]) return false;
      for (const e of bl.ents) {
        const i = e * S + s + k;
        if (this.occ[i] > 0 || m.blocked[i]) return false;
      }
    }
    if (bl.teacher >= 0 && this.dayLoad[bl.teacher * m.D + Math.floor(s / m.P)] + bl.len > m.maxPerDay[bl.teacher]) return false;
    if (r >= 0) return this.roomFree(b, s, r);
    return true;
  }

  roomFree(b: number, s: number, r: number): boolean {
    const m = this.m;
    const bl = m.blocks[b];
    if (!bl.roomOk[r]) return false;
    const e = m.roomOffset + r;
    const base = e * m.S + s;
    const ex = m.exclusive[e];
    for (let k = 0; k < bl.len; k++) {
      if (m.blocked[base + k]) return false;
      if (ex && this.occ[base + k] > 0) return false;
    }
    return true;
  }

  toPlacements(): Placement[] {
    const m = this.m;
    const out: Placement[] = [];
    for (const bl of m.blocks) {
      const s = this.start[bl.id];
      if (s < 0) continue;
      const r = this.room[bl.id];
      out.push({
        assignmentId: bl.assignmentId,
        block: bl.blockIdx,
        day: Math.floor(s / m.P),
        period: (s % m.P) + 1,
        roomId: r >= 0 ? m.rooms[r].id : "",
      });
    }
    return out;
  }

  /** โหลดจาก placements (warm start) — รายการที่ไม่ตรง domain จะถูกละไว้ */
  loadPlacements(ps: Placement[]): void {
    const m = this.m;
    this.clear();
    const byKey = new Map<string, number>();
    m.blocks.forEach((b) => byKey.set(`${b.assignmentId}#${b.blockIdx}`, b.id));
    const rIdx = new Map(m.rooms.map((r, i) => [r.id, i]));
    for (const p of ps) {
      const b = byKey.get(`${p.assignmentId}#${p.block}`);
      if (b === undefined || this.start[b] >= 0) continue;
      const bl = m.blocks[b];
      if (p.day < 0 || p.day >= m.D || p.period < 1 || p.period + bl.len - 1 > m.P) continue;
      const s = p.day * m.P + p.period - 1;
      let r = rIdx.get(p.roomId) ?? -1;
      if (r < 0 || !bl.roomOk[r]) r = bl.rooms[0];
      this.place(b, s, r);
    }
  }
}
