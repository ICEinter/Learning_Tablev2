/**
 * แปลง Dataset → Model แบบ index/array สำหรับ solver (heuristic, GA)
 * - entity = ครู | กลุ่ม | กลุ่มนักเรียนลงทะเบียนข้ามกลุ่ม (cluster) | ห้อง
 * - block = 1 block ของ assignment พร้อม domain ของคาบเริ่ม (starts) และห้องที่ใช้ได้ (rooms)
 * - ข้อจำกัดเชิงเดี่ยว (คาบพัก วันปิด ครูไม่ว่าง กิจกรรมล็อก) ถูกตัดออกจาก domain ล่วงหน้า
 */
import { effectiveBlocks, toMinutes } from "@/shared/slots";
import type { Assignment, Dataset, Room } from "@/shared/types";

export interface BlockInfo {
  id: number;
  a: number;
  assignmentId: string;
  blockIdx: number;
  len: number;
  /** entity index ของครู (-1 ถ้าไม่พบ) */
  teacher: number;
  /** entity ที่ไม่ใช่ห้อง: ครู กลุ่ม cluster */
  ents: number[];
  /** entity index ของกลุ่ม */
  groupEnts: number[];
  starts: Int32Array;
  /** ห้องที่ใช้ได้ (room index 0..R-1) */
  rooms: Int32Array;
  /** ห้องที่ผ่านเงื่อนไขจริง (false = fallback ใช้ทุกห้อง) */
  roomOk: Uint8Array;
  /** true ถ้า starts เป็น fallback ที่ละเมิดข้อจำกัดเชิงเดี่ยว */
  domainFallback: boolean;
  size: number;
  degree: number;
}

export interface Model {
  ds: Dataset;
  P: number;
  D: number;
  S: number;
  T: number;
  G: number;
  K: number;
  R: number;
  E: number;
  A: number;
  rooms: Room[];
  roomOffset: number;
  exclusive: Uint8Array;
  blocked: Uint8Array;
  lockedBusy: Uint8Array;
  pref: Uint8Array;
  late: Uint8Array;
  gridOk: Uint8Array;
  breakP: Uint8Array;
  activeDay: Uint8Array;
  nActive: number;
  maxPerDay: Int32Array;
  blocks: BlockInfo[];
  blocksByAsg: number[][];
  entBlocks: number[][];
  /** ชนิด entity: 0 ครู 1 กลุ่ม 2 cluster 3 ห้อง */
  kind: Uint8Array;
  assignments: Assignment[];
}

export function roomFits(ds: Dataset, a: Assignment, room: Room, size: number): boolean {
  if (size > room.capacity) return false;
  if (a.fixedRoomId) return room.id === a.fixedRoomId;
  const c = ds.courses.find((x) => x.id === a.courseId);
  if (!c) return true;
  if (c.roomType !== room.type) return false;
  return c.requiredEquipment.every((e) => room.equipment.includes(e));
}

export function buildModel(ds: Dataset): Model {
  const P = ds.time.periods.length;
  const D = ds.time.days.length;
  const S = D * P;
  const T = ds.teachers.length;
  const G = ds.groups.length;
  const R = ds.rooms.length;
  const tIdx = new Map(ds.teachers.map((t, i) => [t.id, i]));
  const gIdx = new Map(ds.groups.map((g, i) => [g.id, i]));
  const rIdx = new Map(ds.rooms.map((r, i) => [r.id, i]));
  const courseById = new Map(ds.courses.map((c) => [c.id, c]));
  const asgIdx = new Map(ds.assignments.map((a, i) => [a.id, i]));

  // clusters ของนักเรียนที่ลงทะเบียนเพิ่ม
  const clusterKeys = new Map<string, { g: number; extras: number[] }>();
  for (const st of ds.students) {
    const extras = [...new Set(st.extraAssignmentIds.filter((x) => asgIdx.has(x)))].sort();
    const g = gIdx.get(st.groupId);
    if (!extras.length || g === undefined) continue;
    const key = `${st.groupId}|${extras.join(",")}`;
    if (!clusterKeys.has(key)) clusterKeys.set(key, { g, extras: extras.map((x) => asgIdx.get(x)!) });
  }
  const clusters = [...clusterKeys.values()];
  const K = clusters.length;
  const E = T + G + K + R;
  const roomOffset = T + G + K;

  const kind = new Uint8Array(E);
  for (let e = 0; e < E; e++) kind[e] = e < T ? 0 : e < T + G ? 1 : e < roomOffset ? 2 : 3;
  const exclusive = new Uint8Array(E).fill(1);
  ds.rooms.forEach((r, i) => {
    if (r.type === "external") exclusive[roomOffset + i] = 0;
  });

  const breakP = new Uint8Array(P);
  ds.time.periods.forEach((p, i) => {
    if (p.isBreak) breakP[i] = 1;
  });
  const activeDay = new Uint8Array(D);
  for (let d = 0; d < D; d++) activeDay[d] = ds.time.days.find((x) => x.index === d)?.active ? 1 : 0;
  const nActive = activeDay.reduce((s, x) => s + x, 0);
  const gridOk = new Uint8Array(S);
  for (let s = 0; s < S; s++) gridOk[s] = activeDay[Math.floor(s / P)] && !breakP[s % P] ? 1 : 0;
  const regEnd = toMinutes(ds.school.regularEndTime || "23:59");
  const late = new Uint8Array(S);
  for (let s = 0; s < S; s++) late[s] = toMinutes(ds.time.periods[s % P].end) > regEnd ? 1 : 0;

  const blocked = new Uint8Array(E * S);
  const lockedBusy = new Uint8Array(E * S);
  const pref = new Uint8Array(T * S);
  const slotOf = (day: number, period: number) => (day >= 0 && day < D && period >= 1 && period <= P ? day * P + period - 1 : -1);
  ds.teachers.forEach((t, i) => {
    for (const u of t.unavailable) {
      const s = slotOf(u.day, u.period);
      if (s >= 0) blocked[i * S + s] = 1;
    }
    for (const u of t.preferredOff) {
      const s = slotOf(u.day, u.period);
      if (s >= 0) pref[i * S + s] = 1;
    }
  });
  ds.rooms.forEach((r, i) => {
    for (const u of r.unavailable) {
      const s = slotOf(u.day, u.period);
      if (s >= 0) blocked[(roomOffset + i) * S + s] = 1;
    }
  });
  for (const act of ds.activities) {
    for (let k = 0; k < act.length; k++) {
      const s = slotOf(act.day, act.startPeriod + k);
      if (s < 0) continue;
      if (act.appliesToAll) {
        for (let e = 0; e < roomOffset; e++) {
          blocked[e * S + s] = 1;
          lockedBusy[e * S + s] = 1;
        }
      } else {
        for (const tid of act.teacherIds) {
          const t = tIdx.get(tid);
          if (t !== undefined) {
            blocked[t * S + s] = 1;
            lockedBusy[t * S + s] = 1;
          }
        }
        for (const gid of act.groupIds) {
          const g = gIdx.get(gid);
          if (g !== undefined) {
            blocked[(T + g) * S + s] = 1;
            lockedBusy[(T + g) * S + s] = 1;
          }
        }
      }
      if (act.roomId) {
        const r = rIdx.get(act.roomId);
        if (r !== undefined) blocked[(roomOffset + r) * S + s] = 1;
      }
    }
  }
  // cluster ถูกล็อกตามกลุ่มต้นสังกัด
  clusters.forEach((c, k) => {
    const src = (T + c.g) * S;
    const dst = (T + G + k) * S;
    for (let s = 0; s < S; s++) blocked[dst + s] = blocked[src + s];
  });

  const maxPerDay = new Int32Array(T);
  ds.teachers.forEach((t, i) => (maxPerDay[i] = t.maxPerDay > 0 ? t.maxPerDay : 1 << 20));

  // cluster ที่เกี่ยวกับ assignment
  const asgClusters: number[][] = ds.assignments.map(() => []);
  clusters.forEach((c, k) => {
    const set = new Set<number>(c.extras);
    ds.assignments.forEach((a, ai) => {
      if (a.groupIds.includes(ds.groups[c.g].id)) set.add(ai);
    });
    for (const ai of set) asgClusters[ai].push(T + G + k);
  });

  const blocks: BlockInfo[] = [];
  const blocksByAsg: number[][] = [];
  const entBlocks: number[][] = Array.from({ length: E }, () => []);
  ds.assignments.forEach((a, ai) => {
    const course = courseById.get(a.courseId);
    const sizes = effectiveBlocks(a, course);
    const teacher = tIdx.has(a.teacherId) ? tIdx.get(a.teacherId)! : -1;
    const groupEnts = a.groupIds.filter((g) => gIdx.has(g)).map((g) => T + gIdx.get(g)!);
    const ents = [...(teacher >= 0 ? [teacher] : []), ...groupEnts, ...asgClusters[ai]];
    const size = a.groupIds.reduce((s, g) => s + (ds.groups[gIdx.get(g) ?? -1]?.size ?? 0), 0);
    let rooms = ds.rooms.map((r, i) => (roomFits(ds, a, r, size) ? i : -1)).filter((i) => i >= 0);
    const roomOk = new Uint8Array(R);
    rooms.forEach((r) => (roomOk[r] = 1));
    if (!rooms.length) rooms = ds.rooms.map((_, i) => i);
    const list: number[] = [];
    sizes.forEach((len, bi) => {
      const { starts, fallback } = domainFor(len, ents);
      const id = blocks.length;
      blocks.push({
        id,
        a: ai,
        assignmentId: a.id,
        blockIdx: bi,
        len,
        teacher,
        ents,
        groupEnts,
        starts,
        rooms: Int32Array.from(rooms),
        roomOk,
        domainFallback: fallback,
        size,
        degree: 0,
      });
      list.push(id);
      for (const e of ents) entBlocks[e].push(id);
    });
    blocksByAsg.push(list);
  });
  for (const b of blocks) {
    let deg = 0;
    for (const e of b.ents) deg += entBlocks[e].length - 1;
    b.degree = deg;
  }

  function domainFor(len: number, ents: number[]): { starts: Int32Array; fallback: boolean } {
    const strict: number[] = [];
    const grid: number[] = [];
    const any: number[] = [];
    for (let d = 0; d < D; d++)
      for (let p = 0; p + len <= P; p++) {
        const s0 = d * P + p;
        any.push(s0);
        let ok = true;
        for (let k = 0; k < len; k++) if (!gridOk[s0 + k]) ok = false;
        if (!ok) continue;
        grid.push(s0);
        let free = true;
        for (let k = 0; k < len && free; k++) for (const e of ents) if (blocked[e * S + s0 + k]) free = false;
        if (free) strict.push(s0);
      }
    if (strict.length) return { starts: Int32Array.from(strict), fallback: false };
    if (grid.length) return { starts: Int32Array.from(grid), fallback: true };
    if (any.length) return { starts: Int32Array.from(any), fallback: true };
    return { starts: Int32Array.from([0]), fallback: true };
  }

  return {
    ds,
    P,
    D,
    S,
    T,
    G,
    K,
    R,
    E,
    A: ds.assignments.length,
    rooms: ds.rooms,
    roomOffset,
    exclusive,
    blocked,
    lockedBusy,
    pref,
    late,
    gridOk,
    breakP,
    activeDay,
    nActive,
    maxPerDay,
    blocks,
    blocksByAsg,
    entBlocks,
    kind,
    assignments: ds.assignments,
  };
}
