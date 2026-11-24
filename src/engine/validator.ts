/**
 * Validator อิสระ — ตรวจตาราง (placements) เทียบกับข้อมูล (Dataset) จาก ID ดิบ
 * สร้าง occupancy ใหม่ทั้งหมด ไม่ใช้โค้ดของ solver (บังคับด้วย ESLint)
 *
 * ข้อตกลงสำคัญ
 * - ห้องประเภท "external" (สถานประกอบการ/ภายนอก) ใช้ร่วมกันได้หลายกลุ่มพร้อมกัน (ไม่ตรวจ ROOM_CLASH)
 *   ห้องประเภทอื่นทั้งหมดใช้ได้ทีละรายการ
 * - ถ้า assignment มี fixedRoomId และวางในห้องนั้น จะไม่ตรวจประเภทห้อง/อุปกรณ์ (ตรวจความจุเสมอ)
 * - score.hard = จำนวน Violation ระดับ hard (1 รายการต่อ entity ต่อ slot สำหรับการชน)
 */
import { effectiveBlocks, teacherName, toMinutes } from "@/shared/slots";
import type {
  Assignment,
  Course,
  Dataset,
  LockedActivity,
  Placement,
  Room,
  SlotRef,
  StudentGroup,
  Teacher,
} from "@/shared/types";
import {
  DEFAULT_WEIGHTS,
  SOFT_KEYS,
  type EntityRefKind,
  type HardViolationType,
  type Score,
  type SoftKey,
  type ValidationResult,
  type Violation,
  type Weights,
} from "./types";

type Ent = { kind: EntityRefKind; id: string };

/** ตารางค้นหาที่ใช้ร่วมกับ moves.ts (ไม่มีโค้ด solver) */
export interface Lookup {
  ds: Dataset;
  P: number;
  D: number;
  courseById: Map<string, Course>;
  teacherById: Map<string, Teacher>;
  roomById: Map<string, Room>;
  groupById: Map<string, StudentGroup>;
  asgById: Map<string, Assignment>;
  breakSet: Set<number>;
  lateSet: Set<number>;
  activeDays: boolean[];
  /** slot (day*P + period-1) → กิจกรรมที่ใช้กับทุกคน */
  lockedAll: Map<number, LockedActivity>;
  lockedTeacher: Map<string, Map<number, LockedActivity>>;
  lockedGroup: Map<string, Map<number, LockedActivity>>;
  lockedRoom: Map<string, Map<number, LockedActivity>>;
  blocksOf(a: Assignment): number[];
}

export function slotLabel(ds: Dataset, day: number, period: number): string {
  const d = ds.time.days.find((x) => x.index === day);
  return `${d ? d.short : `วัน${day}`} คาบ ${period}`;
}

export function buildLookup(ds: Dataset): Lookup {
  const P = ds.time.periods.length;
  const D = ds.time.days.length;
  const courseById = new Map(ds.courses.map((c) => [c.id, c]));
  const breakSet = new Set(ds.time.periods.filter((p) => p.isBreak).map((p) => p.no));
  const regEnd = toMinutes(ds.school.regularEndTime || "23:59");
  const lateSet = new Set(ds.time.periods.filter((p) => toMinutes(p.end) > regEnd).map((p) => p.no));
  const activeDays: boolean[] = [];
  for (let d = 0; d < D; d++) activeDays.push(Boolean(ds.time.days.find((x) => x.index === d)?.active));
  const lockedAll = new Map<number, LockedActivity>();
  const lockedTeacher = new Map<string, Map<number, LockedActivity>>();
  const lockedGroup = new Map<string, Map<number, LockedActivity>>();
  const lockedRoom = new Map<string, Map<number, LockedActivity>>();
  const put = (m: Map<string, Map<number, LockedActivity>>, id: string, s: number, a: LockedActivity) => {
    let x = m.get(id);
    if (!x) m.set(id, (x = new Map()));
    if (!x.has(s)) x.set(s, a);
  };
  for (const act of ds.activities) {
    if (act.day < 0 || act.day >= D) continue;
    for (let k = 0; k < act.length; k++) {
      const p = act.startPeriod + k;
      if (p < 1 || p > P) continue;
      const s = act.day * P + (p - 1);
      if (act.appliesToAll) {
        if (!lockedAll.has(s)) lockedAll.set(s, act);
      } else {
        act.teacherIds.forEach((t) => put(lockedTeacher, t, s, act));
        act.groupIds.forEach((g) => put(lockedGroup, g, s, act));
      }
      if (act.roomId) put(lockedRoom, act.roomId, s, act);
    }
  }
  return {
    ds,
    P,
    D,
    courseById,
    teacherById: new Map(ds.teachers.map((t) => [t.id, t])),
    roomById: new Map(ds.rooms.map((r) => [r.id, r])),
    groupById: new Map(ds.groups.map((g) => [g.id, g])),
    asgById: new Map(ds.assignments.map((a) => [a.id, a])),
    breakSet,
    lateSet,
    activeDays,
    lockedAll,
    lockedTeacher,
    lockedGroup,
    lockedRoom,
    blocksOf: (a) => effectiveBlocks(a, courseById.get(a.courseId)),
  };
}

export function asgLabel(L: Lookup, a: Assignment): string {
  const c = L.courseById.get(a.courseId);
  const gs = a.groupIds.map((g) => L.groupById.get(g)?.code ?? g).join(",");
  return `${c ? `${c.code} ${c.name}` : a.courseId} (${gs})`;
}

export function tName(L: Lookup, id: string): string {
  const t = L.teacherById.get(id);
  return t ? teacherName(t) : id;
}

/** ตรวจห้องกับ assignment (ไม่ขึ้นกับเวลา) — คืนรายการ [type, message] */
export function roomIssues(L: Lookup, a: Assignment, room: Room): { type: HardViolationType; message: string }[] {
  const out: { type: HardViolationType; message: string }[] = [];
  const c = L.courseById.get(a.courseId);
  const size = a.groupIds.reduce((s, g) => s + (L.groupById.get(g)?.size ?? 0), 0);
  if (size > room.capacity)
    out.push({ type: "ROOM_CAPACITY", message: `ห้อง ${room.code} จุ ${room.capacity} คน แต่ ${asgLabel(L, a)} มีผู้เรียน ${size} คน` });
  if (a.fixedRoomId) {
    if (room.id !== a.fixedRoomId) {
      const fr = L.roomById.get(a.fixedRoomId);
      out.push({ type: "ROOM_TYPE", message: `${asgLabel(L, a)} ต้องใช้ห้อง ${fr?.code ?? a.fixedRoomId} (กำหนดห้องตายตัว) แต่ถูกวางที่ ${room.code}` });
    }
    return out;
  }
  if (c) {
    if (c.roomType !== room.type)
      out.push({ type: "ROOM_TYPE", message: `${asgLabel(L, a)} ต้องใช้ห้องประเภท ${c.roomType} แต่ห้อง ${room.code} เป็นประเภท ${room.type}` });
    const missing = c.requiredEquipment.filter((e) => !room.equipment.includes(e));
    if (missing.length)
      out.push({ type: "ROOM_EQUIPMENT", message: `ห้อง ${room.code} ไม่มีอุปกรณ์ ${missing.join(", ")} ที่ ${c.code} ต้องใช้` });
  }
  return out;
}

interface PRec {
  idx: number;
  p: Placement;
  a: Assignment;
  len: number;
  /** slot index ที่ครอบคลุม (เฉพาะที่อยู่ในตาราง) */
  slots: number[];
}

export function validate(ds: Dataset, placements: Placement[], weights: Weights = DEFAULT_WEIGHTS): ValidationResult {
  const L = buildLookup(ds);
  const { P, D } = L;
  const V: Violation[] = [];
  const S = (s: number): SlotRef => ({ day: Math.floor(s / P), period: (s % P) + 1 });
  const hard = (type: HardViolationType, message: string, entities: Ent[], slots: SlotRef[] = []) =>
    V.push({ type, severity: "hard", message, entities, slots });

  // ---- ข้อมูลอ้างอิง / ข้อมูลมอบหมาย
  for (const a of ds.assignments) {
    const c = L.courseById.get(a.courseId);
    if (!c) hard("UNKNOWN_REF", `การมอบหมาย ${a.id} อ้างถึงรายวิชา ${a.courseId} ที่ไม่มีอยู่`, [{ kind: "assignment", id: a.id }]);
    const t = L.teacherById.get(a.teacherId);
    if (!t) hard("UNKNOWN_REF", `การมอบหมาย ${a.id} อ้างถึงครู ${a.teacherId} ที่ไม่มีอยู่`, [{ kind: "assignment", id: a.id }]);
    for (const g of a.groupIds)
      if (!L.groupById.has(g)) hard("UNKNOWN_REF", `การมอบหมาย ${a.id} อ้างถึงกลุ่มเรียน ${g} ที่ไม่มีอยู่`, [{ kind: "assignment", id: a.id }]);
    if (a.fixedRoomId && !L.roomById.has(a.fixedRoomId))
      hard("UNKNOWN_REF", `การมอบหมาย ${a.id} กำหนดห้อง ${a.fixedRoomId} ที่ไม่มีอยู่`, [{ kind: "assignment", id: a.id }]);
    if (t && c && t.qualifiedCourseIds.length > 0 && !t.qualifiedCourseIds.includes(c.id))
      hard("UNQUALIFIED", `${teacherName(t)} ไม่มีคุณสมบัติสอน ${c.code} ${c.name}`, [
        { kind: "teacher", id: t.id },
        { kind: "course", id: c.id },
        { kind: "assignment", id: a.id },
      ]);
    if (a.blockSizes && a.blockSizes.length && a.periodsPerWeek !== undefined) {
      const sum = a.blockSizes.reduce((s, n) => s + n, 0);
      if (sum !== a.periodsPerWeek)
        hard("PERIOD_COUNT", `${asgLabel(L, a)} กำหนด ${a.periodsPerWeek} คาบ/สัปดาห์ แต่ผลรวม block = ${sum}`, [{ kind: "assignment", id: a.id }]);
    }
  }
  for (const st of ds.students)
    for (const x of st.extraAssignmentIds)
      if (!L.asgById.has(x))
        hard("UNKNOWN_REF", `นักเรียน ${st.code} ลงทะเบียนการมอบหมาย ${x} ที่ไม่มีอยู่`, [{ kind: "student", id: st.id }]);

  // ---- ตรวจรายการวางทีละรายการ
  const recs: PRec[] = [];
  const seen = new Map<string, number>();
  placements.forEach((p, idx) => {
    const a = L.asgById.get(p.assignmentId);
    if (!a) {
      hard("UNKNOWN_REF", `ตารางอ้างถึงการมอบหมาย ${p.assignmentId} ที่ไม่มีอยู่`, [{ kind: "assignment", id: p.assignmentId }]);
      return;
    }
    const ae: Ent[] = [{ kind: "assignment", id: a.id }];
    const blocks = L.blocksOf(a);
    if (!Number.isInteger(p.block) || p.block < 0 || p.block >= blocks.length) {
      hard("PERIOD_COUNT", `${asgLabel(L, a)} มี block ลำดับ ${p.block} เกินจำนวน block (${blocks.length})`, ae);
      return;
    }
    const key = `${a.id}#${p.block}`;
    if (seen.has(key)) hard("PERIOD_COUNT", `${asgLabel(L, a)} block ${p.block + 1} ถูกวางซ้ำ`, ae, [{ day: p.day, period: p.period }]);
    seen.set(key, idx);
    const len = blocks[p.block];
    if (!Number.isInteger(p.day) || p.day < 0 || p.day >= D || !Number.isInteger(p.period) || p.period < 1 || p.period > P) {
      hard("OUT_OF_GRID", `${asgLabel(L, a)} ถูกวางนอกตาราง (วัน ${p.day} คาบ ${p.period})`, ae, [{ day: p.day, period: p.period }]);
      return;
    }
    const end = p.period + len - 1;
    const slots: number[] = [];
    for (let q = p.period; q <= Math.min(end, P); q++) slots.push(p.day * P + q - 1);
    const refs = slots.map(S);
    if (end > P) hard("BLOCK_SPLIT", `${asgLabel(L, a)} block ${len} คาบ เริ่มคาบ ${p.period} เกินคาบสุดท้ายของวัน (คาบต่อเนื่องคร่อมวัน)`, ae, refs);
    if (!L.activeDays[p.day]) hard("INACTIVE_DAY", `${asgLabel(L, a)} ถูกวางใน${ds.time.days.find((d) => d.index === p.day)?.label ?? `วัน ${p.day}`} ซึ่งปิดการจัดคาบ`, ae, refs);
    const br = refs.filter((r) => L.breakSet.has(r.period));
    if (br.length) hard("BREAK", `${asgLabel(L, a)} ทับคาบพัก (${br.map((r) => slotLabel(ds, r.day, r.period)).join(", ")})`, ae, br);

    const room = L.roomById.get(p.roomId);
    if (!room) hard("UNKNOWN_REF", `${asgLabel(L, a)} ถูกวางในห้อง ${p.roomId} ที่ไม่มีอยู่`, ae);
    else {
      for (const iss of roomIssues(L, a, room)) hard(iss.type, iss.message, [{ kind: "room", id: room.id }, ...ae], refs);
      const un = refs.filter((r) => room.unavailable.some((u) => u.day === r.day && u.period === r.period));
      if (un.length) hard("UNAVAILABLE", `ห้อง ${room.code} ไม่พร้อมใช้ใน ${un.map((r) => slotLabel(ds, r.day, r.period)).join(", ")}`, [{ kind: "room", id: room.id }, ...ae], un);
    }
    const t = L.teacherById.get(a.teacherId);
    if (t) {
      const un = refs.filter((r) => t.unavailable.some((u) => u.day === r.day && u.period === r.period));
      if (un.length) hard("UNAVAILABLE", `${teacherName(t)} ไม่พร้อมสอนใน ${un.map((r) => slotLabel(ds, r.day, r.period)).join(", ")}`, [{ kind: "teacher", id: t.id }, ...ae], un);
    }
    // กิจกรรมล็อก
    const hits = new Map<string, { act: LockedActivity; slots: number[] }>();
    const hit = (act: LockedActivity | undefined, s: number) => {
      if (!act) return;
      const h = hits.get(act.id) ?? { act, slots: [] };
      if (!h.slots.includes(s)) h.slots.push(s);
      hits.set(act.id, h);
    };
    for (const s of slots) {
      hit(L.lockedAll.get(s), s);
      hit(L.lockedTeacher.get(a.teacherId)?.get(s), s);
      for (const g of a.groupIds) hit(L.lockedGroup.get(g)?.get(s), s);
      hit(L.lockedRoom.get(p.roomId)?.get(s), s);
    }
    for (const { act, slots: hs } of hits.values())
      hard("LOCKED", `${asgLabel(L, a)} ทับกิจกรรมล็อก "${act.code}" (${hs.map((s) => slotLabel(ds, S(s).day, S(s).period)).join(", ")})`, [{ kind: "activity", id: act.id }, ...ae], hs.map(S));
    recs.push({ idx, p, a, len, slots });
  });

  // ---- block ที่ขาด
  for (const a of ds.assignments) {
    if (!L.courseById.has(a.courseId) && !(a.blockSizes && a.blockSizes.length)) continue;
    const blocks = L.blocksOf(a);
    const missing: number[] = [];
    for (let b = 0; b < blocks.length; b++) if (!seen.has(`${a.id}#${b}`)) missing.push(b + 1);
    if (missing.length)
      hard("PERIOD_COUNT", `${asgLabel(L, a)} ยังไม่ได้วาง block ที่ ${missing.join(", ")} (ต้องครบ ${blocks.reduce((s, n) => s + n, 0)} คาบ/สัปดาห์)`, [{ kind: "assignment", id: a.id }]);
  }

  // ---- การชน (ครู / กลุ่ม / ห้อง)
  const tOcc = new Map<string, Map<number, PRec[]>>();
  const gOcc = new Map<string, Map<number, PRec[]>>();
  const rOcc = new Map<string, Map<number, PRec[]>>();
  const add = (m: Map<string, Map<number, PRec[]>>, id: string, s: number, r: PRec) => {
    let x = m.get(id);
    if (!x) m.set(id, (x = new Map()));
    const arr = x.get(s);
    if (arr) arr.push(r);
    else x.set(s, [r]);
  };
  for (const r of recs) {
    for (const s of r.slots) {
      add(tOcc, r.a.teacherId, s, r);
      for (const g of r.a.groupIds) add(gOcc, g, s, r);
      const room = L.roomById.get(r.p.roomId);
      if (room && room.type !== "external") add(rOcc, room.id, s, r);
    }
  }
  const clash = (m: Map<string, Map<number, PRec[]>>, type: HardViolationType, kind: EntityRefKind, label: (id: string) => string) => {
    for (const [id, slots] of m)
      for (const [s, arr] of slots) {
        if (arr.length < 2) continue;
        const ref = S(s);
        hard(type, `${label(id)} มี ${arr.length} รายการพร้อมกันใน ${slotLabel(ds, ref.day, ref.period)}: ${arr.map((x) => asgLabel(L, x.a)).join(" / ")}`, [
          { kind, id },
          ...arr.map((x) => ({ kind: "assignment" as const, id: x.a.id })),
        ], [ref]);
      }
  };
  clash(tOcc, "TEACHER_CLASH", "teacher", (id) => `ครู ${tName(L, id)}`);
  clash(rOcc, "ROOM_CLASH", "room", (id) => `ห้อง ${L.roomById.get(id)?.code ?? id}`);
  clash(gOcc, "GROUP_CLASH", "group", (id) => `กลุ่ม ${L.groupById.get(id)?.code ?? id}`);

  // ---- นักเรียนที่ลงทะเบียนข้ามกลุ่ม (รายงานเฉพาะที่ไม่ได้อธิบายด้วย GROUP_CLASH แล้ว)
  const clusters = new Map<string, { groupId: string; extras: string[]; students: string[] }>();
  for (const st of ds.students) {
    const extras = [...new Set(st.extraAssignmentIds.filter((x) => L.asgById.has(x)))].sort();
    if (!extras.length) continue;
    const key = `${st.groupId}|${extras.join(",")}`;
    const c = clusters.get(key) ?? { groupId: st.groupId, extras, students: [] };
    c.students.push(st.id);
    clusters.set(key, c);
  }
  const recsByAsg = new Map<string, PRec[]>();
  for (const r of recs) {
    const arr = recsByAsg.get(r.a.id);
    if (arr) arr.push(r);
    else recsByAsg.set(r.a.id, [r]);
  }
  for (const c of clusters.values()) {
    const asgIds = new Set(ds.assignments.filter((a) => a.groupIds.includes(c.groupId)).map((a) => a.id));
    c.extras.forEach((x) => asgIds.add(x));
    const bySlot = new Map<number, PRec[]>();
    for (const id of asgIds)
      for (const r of recsByAsg.get(id) ?? [])
        for (const s of r.slots) {
          const arr = bySlot.get(s);
          if (arr) arr.push(r);
          else bySlot.set(s, [r]);
        }
    const stEnts: Ent[] = c.students.map((id) => ({ kind: "student", id }));
    const gCode = L.groupById.get(c.groupId)?.code ?? c.groupId;
    for (const [s, arr] of bySlot) {
      const ref = S(s);
      let unexplained = false;
      for (let i = 0; i < arr.length && !unexplained; i++)
        for (let j = i + 1; j < arr.length; j++)
          if (!arr[i].a.groupIds.some((g) => arr[j].a.groupIds.includes(g))) {
            unexplained = true;
            break;
          }
      if (unexplained)
        hard("STUDENT_CLASH", `นักเรียน ${c.students.length} คนของกลุ่ม ${gCode} ที่ลงทะเบียนเพิ่ม มีวิชาชนกันใน ${slotLabel(ds, ref.day, ref.period)}: ${arr.map((x) => asgLabel(L, x.a)).join(" / ")}`, [
          ...stEnts,
          ...arr.map((x) => ({ kind: "assignment" as const, id: x.a.id })),
        ], [ref]);
      // วิชาที่ลงเพิ่ม (ไม่ใช่ของกลุ่ม) ทับกิจกรรมล็อกของกลุ่มตนเอง
      const act = L.lockedAll.has(s) ? undefined : L.lockedGroup.get(c.groupId)?.get(s);
      if (act)
        for (const r of arr)
          if (!r.a.groupIds.includes(c.groupId))
            hard("STUDENT_CLASH", `นักเรียนกลุ่ม ${gCode} ที่ลงทะเบียน ${asgLabel(L, r.a)} ชนกับกิจกรรมล็อก "${act.code}" ใน ${slotLabel(ds, ref.day, ref.period)}`, [
              ...stEnts,
              { kind: "assignment", id: r.a.id },
              { kind: "activity", id: act.id },
            ], [ref]);
    }
  }

  // ---- ภาระครู (นับเฉพาะคาบสอน)
  const tDay = new Map<string, number[]>();
  for (const r of recs) {
    const arr = tDay.get(r.a.teacherId) ?? new Array(D).fill(0);
    arr[r.p.day] += r.slots.length;
    tDay.set(r.a.teacherId, arr);
  }
  for (const [tid, arr] of tDay) {
    const t = L.teacherById.get(tid);
    if (!t) continue;
    arr.forEach((n, d) => {
      if (n > t.maxPerDay)
        hard("TEACHER_LOAD", `${teacherName(t)} สอน ${n} คาบใน${ds.time.days.find((x) => x.index === d)?.label ?? `วัน ${d}`} เกินกำหนด ${t.maxPerDay} คาบ/วัน`, [{ kind: "teacher", id: tid }], []);
    });
    const w = arr.reduce((s, n) => s + n, 0);
    if (w > t.maxPerWeek) hard("TEACHER_LOAD", `${teacherName(t)} สอน ${w} คาบ/สัปดาห์ เกินกำหนด ${t.maxPerWeek} คาบ`, [{ kind: "teacher", id: tid }], []);
  }

  // ---- Soft
  const breakdown = softBreakdown(L, recs);
  const soft = SOFT_KEYS.reduce((s, k) => s + (weights[k] ?? 0) * breakdown[k], 0);
  for (const k of SOFT_KEYS)
    if (breakdown[k] > 0)
      V.push({ type: k, severity: "soft", message: softMessage(k, breakdown[k]), entities: [], slots: [] });
  const score: Score = { hard: V.filter((v) => v.severity === "hard").length, soft, breakdown };
  return { violations: V, score };
}

const SOFT_MSG: Record<SoftKey, string> = {
  teacherGaps: "คาบว่างคั่นระหว่างคาบสอนของครูรวม",
  studentGaps: "คาบว่างคั่นของกลุ่มเรียนรวม",
  dayBalance: "ความไม่สมดุลของจำนวนคาบรายวันรวม",
  roomChanges: "จำนวนครั้งที่กลุ่มเรียนต้องย้ายห้องระหว่างคาบ",
  preferredTimes: "จำนวนคาบที่ตรงกับเวลาที่ครูขอเลี่ยง",
  sameCourseSameDay: "จำนวน block ของวิชาเดียวกันที่ซ้ำวันเดียวกัน",
  lateHours: "จำนวนคาบที่อยู่นอกเวลาราชการ",
};

function softMessage(k: SoftKey, n: number): string {
  return `${SOFT_MSG[k]} ${n}`;
}

/**
 * นิยาม Soft (ต้องตรงกับ engine/state.ts — มีชุดทดสอบเทียบผล)
 * - teacherGaps/studentGaps: ในแต่ละวันที่มีคาบสอน ≥ 1 นับคาบที่ไม่ใช่คาบพักและว่าง ระหว่างคาบแรกถึงคาบสุดท้ายที่ "ไม่ว่าง"
 *   (ไม่ว่าง = มีคาบสอน หรือมีกิจกรรมล็อกของครู/กลุ่มนั้น)
 * - dayBalance: ต่อครูและกลุ่มที่มีคาบสอน: (มากสุด − น้อยสุด ของจำนวนคาบสอนต่อวันในวันที่เปิด) − (0 ถ้าหารลงตัว ไม่เช่นนั้น 1), ต่ำสุด 0
 * - roomChanges: ต่อกลุ่มต่อวัน ไล่คาบที่มีเรียนตามลำดับ นับเมื่อคาบติดกันในลำดับนั้นมีรายการเดียวทั้งคู่และห้องต่างกัน
 * - preferredTimes: จำนวนคาบสอนที่ตรงกับ preferredOff ของครู
 * - sameCourseSameDay: ต่อ assignment ต่อวัน Σ max(0, จำนวน block − 1)
 * - lateHours: จำนวนคาบสอน (ต่อรายการวาง) ที่เวลาสิ้นสุดเกิน regularEndTime
 */
function softBreakdown(L: Lookup, recs: PRec[]): Record<SoftKey, number> {
  const { P, D } = L;
  const out: Record<SoftKey, number> = { teacherGaps: 0, studentGaps: 0, dayBalance: 0, roomChanges: 0, preferredTimes: 0, sameCourseSameDay: 0, lateHours: 0 };
  const tCnt = new Map<string, Int32Array>();
  const gCnt = new Map<string, Int32Array>();
  const gRoom = new Map<string, string[]>();
  const aDay = new Map<string, Int32Array>();
  const cnt = (m: Map<string, Int32Array>, id: string) => {
    let x = m.get(id);
    if (!x) m.set(id, (x = new Int32Array(D * P)));
    return x;
  };
  for (const r of recs) {
    const t = cnt(tCnt, r.a.teacherId);
    const teacher = L.teacherById.get(r.a.teacherId);
    for (const s of r.slots) {
      t[s]++;
      const per = (s % P) + 1;
      if (L.lateSet.has(per)) out.lateHours++;
      if (teacher && teacher.preferredOff.some((u) => u.day === r.p.day && u.period === per)) out.preferredTimes++;
      for (const g of r.a.groupIds) {
        cnt(gCnt, g)[s]++;
        let rr = gRoom.get(g);
        if (!rr) gRoom.set(g, (rr = new Array(D * P).fill("")));
        rr[s] = r.p.roomId;
      }
    }
    cnt(aDay, r.a.id)[r.p.day]++;
  }
  for (const arr of aDay.values()) for (let d = 0; d < D; d++) if (arr[d] > 1) out.sameCourseSameDay += arr[d] - 1;

  const nActive = L.activeDays.filter(Boolean).length;
  const gaps = (c: Int32Array, locked: (s: number) => boolean) => {
    let total = 0;
    for (let d = 0; d < D; d++) {
      let load = 0;
      for (let p = 0; p < P; p++) load += c[d * P + p];
      if (load === 0) continue;
      let first = -1;
      let last = -1;
      for (let p = 0; p < P; p++) {
        const s = d * P + p;
        if (c[s] > 0 || locked(s)) {
          if (first < 0) first = p;
          last = p;
        }
      }
      for (let p = first + 1; p < last; p++) {
        const s = d * P + p;
        if (c[s] === 0 && !locked(s) && !L.breakSet.has(p + 1)) total++;
      }
    }
    return total;
  };
  const balance = (c: Int32Array) => {
    if (nActive === 0) return 0;
    let mx = -Infinity;
    let mn = Infinity;
    let tot = 0;
    for (let d = 0; d < D; d++) {
      if (!L.activeDays[d]) continue;
      let load = 0;
      for (let p = 0; p < P; p++) load += c[d * P + p];
      tot += load;
      if (load > mx) mx = load;
      if (load < mn) mn = load;
    }
    if (tot === 0) return 0;
    return Math.max(0, mx - mn - (tot % nActive === 0 ? 0 : 1));
  };
  for (const [tid, c] of tCnt) {
    if (!L.teacherById.has(tid)) continue;
    const lt = L.lockedTeacher.get(tid);
    out.teacherGaps += gaps(c, (s) => L.lockedAll.has(s) || Boolean(lt?.has(s)));
    out.dayBalance += balance(c);
  }
  for (const [gid, c] of gCnt) {
    if (!L.groupById.has(gid)) continue;
    const lg = L.lockedGroup.get(gid);
    out.studentGaps += gaps(c, (s) => L.lockedAll.has(s) || Boolean(lg?.has(s)));
    out.dayBalance += balance(c);
    const rr = gRoom.get(gid)!;
    for (let d = 0; d < D; d++) {
      let prev = -1;
      for (let p = 0; p < P; p++) {
        const s = d * P + p;
        if (c[s] === 0) continue;
        if (prev >= 0 && c[prev] === 1 && c[s] === 1 && rr[prev] !== rr[s]) out.roomChanges++;
        prev = s;
      }
    }
  }
  return out;
}
