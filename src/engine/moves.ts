/**
 * สนับสนุนการแก้ไขตารางด้วยมือ: หาตำแหน่งที่ย้าย block ได้โดยไม่ก่อ Hard ใหม่
 * (ไม่สนใจตำแหน่งปัจจุบันของ block ที่กำลังย้าย) ใช้ตารางค้นหาจาก validator ไม่ใช้โค้ด solver
 */
import { teacherName } from "@/shared/slots";
import type { Assignment, Dataset, Placement } from "@/shared/types";
import { asgLabel, buildLookup, roomIssues, slotLabel, type Lookup } from "./validator";

export interface MoveTarget {
  day: number;
  period: number;
  okRoomIds: string[];
  /** เหตุผล (ภาษาไทย) ที่ย้ายไปไม่ได้ เมื่อ okRoomIds ว่าง */
  reasons: string[];
}

interface Ctx {
  L: Lookup;
  a: Assignment;
  len: number;
  /** slot → ข้อความ ของสิ่งที่ครอบครองอยู่ */
  teacherBusy: Map<number, string>;
  groupBusy: Map<number, string>;
  studentBusy: Map<number, string>;
  roomBusy: Map<string, Map<number, string>>;
  teacherDay: number[];
}

function buildCtx(ds: Dataset, placements: Placement[], assignmentId: string, block: number): Ctx | null {
  const L = buildLookup(ds);
  const a = L.asgById.get(assignmentId);
  if (!a) return null;
  const blocks = L.blocksOf(a);
  if (block < 0 || block >= blocks.length) return null;
  const len = blocks[block];
  const { P, D } = L;
  const teacherBusy = new Map<number, string>();
  const groupBusy = new Map<number, string>();
  const studentBusy = new Map<number, string>();
  const roomBusy = new Map<string, Map<number, string>>();
  const teacherDay = new Array(D).fill(0);

  // clusters นักเรียนที่เกี่ยวข้องกับ assignment นี้
  const relClusters: { groupId: string; asgIds: Set<string> }[] = [];
  const seen = new Set<string>();
  for (const st of ds.students) {
    const extras = st.extraAssignmentIds.filter((x) => L.asgById.has(x));
    if (!extras.length) continue;
    const key = `${st.groupId}|${[...new Set(extras)].sort().join(",")}`;
    if (seen.has(key)) continue;
    const asgIds = new Set(ds.assignments.filter((x) => x.groupIds.includes(st.groupId)).map((x) => x.id));
    extras.forEach((x) => asgIds.add(x));
    if (!asgIds.has(a.id)) continue;
    seen.add(key);
    relClusters.push({ groupId: st.groupId, asgIds });
  }

  for (const p of placements) {
    if (p.assignmentId === assignmentId && p.block === block) continue;
    const q = L.asgById.get(p.assignmentId);
    if (!q) continue;
    const qb = L.blocksOf(q);
    if (p.block < 0 || p.block >= qb.length || p.day < 0 || p.day >= D || p.period < 1 || p.period > P) continue;
    const label = asgLabel(L, q);
    for (let k = 0; k < qb[p.block]; k++) {
      const per = p.period + k;
      if (per > P) break;
      const s = p.day * P + per - 1;
      if (q.teacherId === a.teacherId) {
        teacherBusy.set(s, label);
      }
      if (q.groupIds.some((g) => a.groupIds.includes(g))) groupBusy.set(s, label);
      else if (relClusters.some((c) => c.asgIds.has(q.id))) studentBusy.set(s, label);
      const room = L.roomById.get(p.roomId);
      if (room && room.type !== "external") {
        let m = roomBusy.get(room.id);
        if (!m) roomBusy.set(room.id, (m = new Map()));
        m.set(s, label);
      }
    }
    if (q.teacherId === a.teacherId) teacherDay[p.day] += Math.min(qb[p.block], P - p.period + 1);
  }
  // วิชาที่ลงเพิ่มข้ามกลุ่ม ห้ามทับกิจกรรมล็อกของกลุ่มต้นสังกัดของนักเรียน
  for (const c of relClusters) {
    if (a.groupIds.includes(c.groupId)) continue;
    for (const [s, act] of L.lockedGroup.get(c.groupId) ?? []) studentBusy.set(s, `กิจกรรม "${act.code}" ของนักเรียนที่ลงทะเบียน`);
  }
  return { L, a, len, teacherBusy, groupBusy, studentBusy, roomBusy, teacherDay };
}

/** เหตุผลด้านเวลา (ไม่ขึ้นกับห้อง) */
function timeReasons(c: Ctx, day: number, period: number): string[] {
  const { L, a, len } = c;
  const { ds, P, D } = L;
  const out: string[] = [];
  if (day < 0 || day >= D || period < 1 || period > P) return ["อยู่นอกตาราง"];
  if (period + len - 1 > P) out.push(`block ${len} คาบเกินคาบสุดท้ายของวัน`);
  if (!L.activeDays[day]) out.push("วันนี้ปิดการจัดคาบ");
  const t = L.teacherById.get(a.teacherId);
  const tn = t ? teacherName(t) : a.teacherId;
  for (let k = 0; k < len; k++) {
    const per = period + k;
    if (per > P) break;
    const s = day * P + per - 1;
    const at = slotLabel(ds, day, per);
    if (L.breakSet.has(per)) out.push(`${at} เป็นคาบพัก`);
    if (t?.unavailable.some((u) => u.day === day && u.period === per)) out.push(`${tn} ไม่พร้อมสอน ${at}`);
    const la = L.lockedAll.get(s) ?? L.lockedTeacher.get(a.teacherId)?.get(s) ?? a.groupIds.map((g) => L.lockedGroup.get(g)?.get(s)).find(Boolean);
    if (la) out.push(`${at} ทับกิจกรรมล็อก "${la.code}"`);
    const tb = c.teacherBusy.get(s);
    if (tb) out.push(`${tn} มีสอน ${tb} ใน ${at}`);
    const gb = c.groupBusy.get(s);
    if (gb) out.push(`กลุ่มเรียนมี ${gb} ใน ${at}`);
    const sb = c.studentBusy.get(s);
    if (sb) out.push(`นักเรียนที่ลงทะเบียนร่วมติด ${sb} ใน ${at}`);
  }
  if (t && L.activeDays[day]) {
    const n = c.teacherDay[day] + Math.min(len, P - period + 1);
    if (n > t.maxPerDay) out.push(`${tn} จะสอน ${n} คาบในวันนี้ เกิน ${t.maxPerDay} คาบ/วัน`);
  }
  return [...new Set(out)];
}

function roomReasons(c: Ctx, day: number, period: number, roomId: string): string[] {
  const { L, a, len } = c;
  const room = L.roomById.get(roomId);
  if (!room) return [`ไม่พบห้อง ${roomId}`];
  const out = roomIssues(L, a, room).map((x) => x.message);
  for (let k = 0; k < len; k++) {
    const per = period + k;
    if (per > L.P) break;
    const s = day * L.P + per - 1;
    const at = slotLabel(L.ds, day, per);
    if (room.unavailable.some((u) => u.day === day && u.period === per)) out.push(`ห้อง ${room.code} ไม่พร้อมใช้ ${at}`);
    const act = L.lockedRoom.get(room.id)?.get(s);
    if (act) out.push(`ห้อง ${room.code} ถูกใช้โดยกิจกรรม "${act.code}" ${at}`);
    const busy = c.roomBusy.get(room.id)?.get(s);
    if (busy) out.push(`ห้อง ${room.code} มี ${busy} ใน ${at}`);
  }
  return out;
}

export function moveTargets(ds: Dataset, placements: Placement[], assignmentId: string, block: number): MoveTarget[] {
  const c = buildCtx(ds, placements, assignmentId, block);
  if (!c) return [];
  const out: MoveTarget[] = [];
  for (let day = 0; day < c.L.D; day++)
    for (let period = 1; period <= c.L.P; period++) {
      const reasons = timeReasons(c, day, period);
      if (reasons.length) {
        out.push({ day, period, okRoomIds: [], reasons });
        continue;
      }
      const okRoomIds = ds.rooms.filter((r) => roomReasons(c, day, period, r.id).length === 0).map((r) => r.id);
      out.push({ day, period, okRoomIds, reasons: okRoomIds.length ? [] : ["ไม่มีห้องที่ตรงเงื่อนไขว่างในช่วงเวลานี้"] });
    }
  return out;
}

export function evaluateMove(
  ds: Dataset,
  placements: Placement[],
  assignmentId: string,
  block: number,
  target: { day: number; period: number; roomId: string },
): { ok: boolean; reasons: string[] } {
  const c = buildCtx(ds, placements, assignmentId, block);
  if (!c) return { ok: false, reasons: [`ไม่พบรายการมอบหมาย ${assignmentId} block ${block}`] };
  const reasons = [...timeReasons(c, target.day, target.period)];
  if (!reasons.includes("อยู่นอกตาราง")) reasons.push(...roomReasons(c, target.day, target.period, target.roomId));
  return { ok: reasons.length === 0, reasons };
}
