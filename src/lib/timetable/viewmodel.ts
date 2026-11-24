/**
 * View model ของตาราง — ใช้ร่วมกันระหว่างหน้าจอ, PDF และ Excel
 * (ไม่มี React — ทดสอบด้วย Node ได้)
 *
 * รูปแบบตามตัวอย่าง: วัน = แถว, คาบพร้อมเวลา = คอลัมน์, คาบต่อเนื่องรวมเซลล์,
 * แต่ละช่องแสดง รหัสวิชา / ห้อง / กลุ่มเรียน(จำนวน) และแยกกิจกรรมออกจากคาบสอน
 */
import { effectiveBlocks, effectivePeriods, teacherName, toMinutes } from "@/shared/slots";
import type {
  Assignment,
  Course,
  Dataset,
  DayDef,
  ID,
  LockedActivity,
  Period,
  Placement,
  SlotRef,
} from "@/shared/types";

export type ViewKind = "teacher" | "room" | "group" | "student" | "course";

export const VIEW_LABEL: Record<ViewKind, string> = {
  teacher: "ครู",
  room: "ห้อง",
  group: "กลุ่มเรียน",
  student: "นักเรียน",
  course: "รายวิชา",
};

export interface CellItem {
  kind: "lesson" | "activity";
  assignmentId?: ID;
  block?: number;
  activityId?: ID;
  courseId?: ID;
  code: string;
  name: string;
  teacherIds: ID[];
  teacherLabel: string;
  roomId?: ID;
  roomLabel: string;
  groupIds: ID[];
  groupLabel: string;
  /** ข้อความ 3 บรรทัดสำหรับแสดงในช่อง (ขึ้นกับมุมมอง) */
  lines: string[];
}

export type CellState = "empty" | "lesson" | "activity" | "break" | "inactive" | "unavailable";

export interface GridCell {
  day: number;
  startPeriod: number;
  span: number;
  state: CellState;
  items: CellItem[];
  conflict: boolean;
}

export interface GridRow {
  day: DayDef;
  cells: GridCell[];
}

export interface SummaryRow {
  code: string;
  name: string;
  theory: number | null;
  practice: number | null;
  credits: number | null;
  hours: number;
  isActivity: boolean;
  /** รายละเอียดเพิ่มเติม (เช่น ครูผู้สอน/กลุ่ม) */
  detail?: string;
}

export interface GridStats {
  teachingPeriods: number;
  activityPeriods: number;
  freePeriods: number;
  consecutiveBlocks: number;
  maxPerDay: number;
  inRegular: number;
  outRegular: number;
}

export interface TimetableGrid {
  kind: ViewKind;
  entityId: ID;
  title: string;
  meta: { label: string; value: string }[];
  periods: Period[];
  preActivity?: { label: string; start: string; end: string };
  rows: GridRow[];
  summary: SummaryRow[];
  totals: { theory: number; practice: number; credits: number; hours: number };
  stats: GridStats;
}

export interface BuildOptions {
  /** ช่องที่มีข้อขัดแย้ง (Hard) เพื่อไฮไลต์ */
  conflictSlots?: SlotRef[];
  /** แสดงช่องที่ครู/ห้องไม่พร้อมใช้งาน */
  showUnavailable?: boolean;
}

export interface Lookup {
  course: Map<ID, Course>;
  teacher: Map<ID, Dataset["teachers"][number]>;
  room: Map<ID, Dataset["rooms"][number]>;
  group: Map<ID, Dataset["groups"][number]>;
  student: Map<ID, Dataset["students"][number]>;
  assignment: Map<ID, Assignment>;
}

export function buildLookup(ds: Dataset): Lookup {
  return {
    course: new Map(ds.courses.map((x) => [x.id, x])),
    teacher: new Map(ds.teachers.map((x) => [x.id, x])),
    room: new Map(ds.rooms.map((x) => [x.id, x])),
    group: new Map(ds.groups.map((x) => [x.id, x])),
    student: new Map(ds.students.map((x) => [x.id, x])),
    assignment: new Map(ds.assignments.map((x) => [x.id, x])),
  };
}

function groupLabel(L: Lookup, ids: ID[], withSize = true): string {
  return ids
    .map((g) => {
      const x = L.group.get(g);
      if (!x) return g;
      const note = x.note ? ` (${x.note})` : "";
      return withSize ? `${x.code}${note} (${x.size})` : x.code;
    })
    .join(", ");
}

/** รายการมอบหมายสอน/กิจกรรมที่เกี่ยวข้องกับ entity ของมุมมอง */
function relevantAssignments(ds: Dataset, kind: ViewKind, id: ID): Set<ID> {
  const out = new Set<ID>();
  if (kind === "teacher") ds.assignments.filter((a) => a.teacherId === id).forEach((a) => out.add(a.id));
  if (kind === "group") ds.assignments.filter((a) => a.groupIds.includes(id)).forEach((a) => out.add(a.id));
  if (kind === "course") ds.assignments.filter((a) => a.courseId === id).forEach((a) => out.add(a.id));
  if (kind === "student") {
    const s = ds.students.find((x) => x.id === id);
    if (s) {
      ds.assignments.filter((a) => a.groupIds.includes(s.groupId)).forEach((a) => out.add(a.id));
      s.extraAssignmentIds.forEach((x) => out.add(x));
    }
  }
  return out;
}

function relevantActivities(ds: Dataset, kind: ViewKind, id: ID): LockedActivity[] {
  if (kind === "teacher") return ds.activities.filter((a) => a.appliesToAll || a.teacherIds.includes(id));
  if (kind === "group") return ds.activities.filter((a) => a.appliesToAll || a.groupIds.includes(id));
  if (kind === "student") {
    const s = ds.students.find((x) => x.id === id);
    return s ? ds.activities.filter((a) => a.appliesToAll || a.groupIds.includes(s.groupId)) : [];
  }
  if (kind === "room") return ds.activities.filter((a) => a.roomId === id);
  return [];
}

function lessonLines(kind: ViewKind, item: Omit<CellItem, "lines">): string[] {
  switch (kind) {
    case "teacher":
      return [item.code, item.roomLabel, item.groupLabel];
    case "room":
      return [item.code, item.teacherLabel, item.groupLabel];
    case "group":
    case "student":
      return [item.code, item.roomLabel, item.teacherLabel];
    case "course":
      return [item.groupLabel, item.teacherLabel, item.roomLabel];
  }
}

export function entityTitle(ds: Dataset, kind: ViewKind, id: ID): string {
  const L = buildLookup(ds);
  switch (kind) {
    case "teacher": {
      const t = L.teacher.get(id);
      return t ? teacherName(t) : id;
    }
    case "room":
      return L.room.get(id)?.name ?? id;
    case "group": {
      const g = L.group.get(id);
      return g ? `${g.code} ${g.name}` : id;
    }
    case "student": {
      const s = L.student.get(id);
      return s ? `${s.code} ${s.displayName}` : id;
    }
    case "course": {
      const c = L.course.get(id);
      return c ? `${c.code} ${c.name}` : id;
    }
  }
}

/** รายชื่อ entity สำหรับตัวเลือกในแต่ละมุมมอง */
export function entityOptions(ds: Dataset, kind: ViewKind): { id: ID; label: string }[] {
  switch (kind) {
    case "teacher":
      return ds.teachers.map((t) => ({ id: t.id, label: `${teacherName(t)} (${t.code})` }));
    case "room":
      return ds.rooms.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` }));
    case "group":
      return ds.groups.map((g) => ({ id: g.id, label: `${g.code} — ${g.name}` }));
    case "student":
      return ds.students.map((s) => ({ id: s.id, label: `${s.code} ${s.displayName}` }));
    case "course":
      return ds.courses.map((c) => ({ id: c.id, label: `${c.code} ${c.name}` }));
  }
}

export function buildGrid(ds: Dataset, placements: Placement[], kind: ViewKind, entityId: ID, opts: BuildOptions = {}): TimetableGrid {
  const L = buildLookup(ds);
  const P = ds.time.periods.length;
  const asgSet = relevantAssignments(ds, kind, entityId);
  const acts = relevantActivities(ds, kind, entityId);

  // slot -> items
  const slotItems = new Map<string, CellItem[]>();
  const push = (day: number, period: number, item: CellItem) => {
    const k = `${day}:${period}`;
    const arr = slotItems.get(k) ?? [];
    arr.push(item);
    slotItems.set(k, arr);
  };

  for (const pl of placements) {
    const inView = kind === "room" ? pl.roomId === entityId : asgSet.has(pl.assignmentId);
    if (!inView) continue;
    const a = L.assignment.get(pl.assignmentId);
    if (!a) continue;
    const c = L.course.get(a.courseId);
    const blocks = effectiveBlocks(a, c);
    const len = blocks[pl.block] ?? 1;
    const t = L.teacher.get(a.teacherId);
    const r = L.room.get(pl.roomId);
    const base: Omit<CellItem, "lines"> = {
      kind: "lesson",
      assignmentId: a.id,
      block: pl.block,
      courseId: a.courseId,
      code: c?.code ?? a.courseId,
      name: c?.name ?? "",
      teacherIds: [a.teacherId],
      teacherLabel: t ? `${t.prefix}${t.firstName}` : a.teacherId,
      roomId: pl.roomId,
      roomLabel: r?.code ?? pl.roomId,
      groupIds: a.groupIds,
      groupLabel: groupLabel(L, a.groupIds),
    };
    const item: CellItem = { ...base, lines: lessonLines(kind, base) };
    for (let i = 0; i < len; i++) push(pl.day, pl.period + i, item);
  }

  for (const act of acts) {
    const r = act.roomId ? L.room.get(act.roomId) : undefined;
    const gl = act.appliesToAll ? "ทุกกลุ่ม" : groupLabel(L, act.groupIds);
    const item: CellItem = {
      kind: "activity",
      activityId: act.id,
      code: act.code,
      name: act.name,
      teacherIds: act.teacherIds,
      teacherLabel: "",
      roomId: act.roomId,
      roomLabel: r?.code ?? "",
      groupIds: act.groupIds,
      groupLabel: gl,
      lines: kind === "teacher" || kind === "room" ? [act.code, r?.code ?? "", act.groupIds.length ? gl : ""] : [act.code, r?.code ?? "", ""],
    };
    for (let i = 0; i < act.length; i++) push(act.day, act.startPeriod + i, item);
  }

  const conflict = new Set((opts.conflictSlots ?? []).map((s) => `${s.day}:${s.period}`));
  const unavailable = new Set<string>();
  if (opts.showUnavailable !== false) {
    if (kind === "teacher") L.teacher.get(entityId)?.unavailable.forEach((s) => unavailable.add(`${s.day}:${s.period}`));
    if (kind === "room") L.room.get(entityId)?.unavailable.forEach((s) => unavailable.add(`${s.day}:${s.period}`));
  }

  const itemKey = (it: CellItem) => (it.kind === "lesson" ? `L:${it.assignmentId}:${it.block}` : `A:${it.activityId}`);

  const rows: GridRow[] = ds.time.days.map((day) => {
    const cells: GridCell[] = [];
    let p = 1;
    while (p <= P) {
      const items = slotItems.get(`${day.index}:${p}`) ?? [];
      const period = ds.time.periods[p - 1];
      const key = items.map(itemKey).sort().join("|");
      let span = 1;
      if (items.length > 0) {
        while (p + span <= P) {
          const next = slotItems.get(`${day.index}:${p + span}`) ?? [];
          if (next.map(itemKey).sort().join("|") !== key) break;
          span++;
        }
      }
      let state: CellState;
      if (items.length > 0) state = items.every((i) => i.kind === "activity") ? "activity" : "lesson";
      else if (period?.isBreak) state = "break";
      else if (!day.active) state = "inactive";
      else if (unavailable.has(`${day.index}:${p}`)) state = "unavailable";
      else state = "empty";
      let hasConflict = items.length > 1 && kind !== "course";
      for (let i = 0; i < span; i++) if (conflict.has(`${day.index}:${p + i}`)) hasConflict = true;
      cells.push({ day: day.index, startPeriod: p, span, state, items, conflict: hasConflict && items.length > 0 });
      p += span;
    }
    return { day, cells };
  });

  const { summary, totals } = buildSummary(ds, L, kind, entityId, asgSet, acts);
  const stats = buildStats(ds, slotItems);

  return {
    kind,
    entityId,
    title: entityTitle(ds, kind, entityId),
    meta: buildMeta(ds, L, kind, entityId),
    periods: ds.time.periods,
    preActivity: ds.time.preActivity,
    rows,
    summary,
    totals,
    stats,
  };
}

function buildMeta(ds: Dataset, L: Lookup, kind: ViewKind, id: ID): { label: string; value: string }[] {
  const term = { label: "ภาคเรียน", value: `${ds.term.term}/${ds.term.year}` };
  if (kind === "teacher") {
    const t = L.teacher.get(id);
    if (!t) return [term];
    return [
      term,
      { label: "ผู้สอน", value: teacherName(t) },
      { label: "วุฒิการศึกษา", value: t.degree ?? "-" },
      { label: "แผนกวิชา", value: t.department ?? "-" },
      { label: "หน้าที่พิเศษ", value: t.specialDuty ?? "-" },
    ];
  }
  if (kind === "group") {
    const g = L.group.get(id);
    if (!g) return [term];
    const adv = g.advisorTeacherId ? L.teacher.get(g.advisorTeacherId) : undefined;
    return [
      term,
      { label: "กลุ่มเรียน", value: `${g.code} ${g.name}` },
      { label: "จำนวนผู้เรียน", value: `${g.size} คน` },
      { label: "ครูที่ปรึกษา", value: adv ? teacherName(adv) : "-" },
    ];
  }
  if (kind === "student") {
    const s = L.student.get(id);
    if (!s) return [term];
    const g = L.group.get(s.groupId);
    return [term, { label: "นักเรียน", value: `${s.code} ${s.displayName}` }, { label: "กลุ่มเรียน", value: g ? g.code : "-" }];
  }
  if (kind === "room") {
    const r = L.room.get(id);
    if (!r) return [term];
    return [term, { label: "ห้อง", value: `${r.code} ${r.name}` }, { label: "ความจุ", value: `${r.capacity} คน` }, { label: "อุปกรณ์", value: r.equipment.join(", ") || "-" }];
  }
  const c = L.course.get(id);
  if (!c) return [term];
  return [term, { label: "รายวิชา", value: `${c.code} ${c.name}` }, { label: "ท-ป-น", value: `${c.theory}-${c.practice}-${c.credits}` }];
}

function buildSummary(
  ds: Dataset,
  L: Lookup,
  kind: ViewKind,
  id: ID,
  asgSet: Set<ID>,
  acts: LockedActivity[],
): { summary: SummaryRow[]; totals: TimetableGrid["totals"] } {
  const rows: SummaryRow[] = [];
  const byCourse = new Map<ID, { hours: number; details: Set<string> }>();
  const asgs = kind === "room" ? [] : ds.assignments.filter((a) => asgSet.has(a.id));
  for (const a of asgs) {
    const c = L.course.get(a.courseId);
    const cur = byCourse.get(a.courseId) ?? { hours: 0, details: new Set<string>() };
    cur.hours += effectivePeriods(a, c);
    const t = L.teacher.get(a.teacherId);
    if (kind === "teacher") cur.details.add(groupLabel(L, a.groupIds, false));
    else if (t) cur.details.add(teacherName(t));
    byCourse.set(a.courseId, cur);
  }
  let theory = 0,
    practice = 0,
    credits = 0,
    hours = 0;
  for (const [cid, v] of byCourse) {
    const c = L.course.get(cid);
    if (!c) continue;
    rows.push({
      code: c.code,
      name: c.name,
      theory: c.theory,
      practice: c.practice,
      credits: c.credits,
      hours: kind === "teacher" ? v.hours : effectivePeriods({ id: "", courseId: cid, teacherId: "", groupIds: [] }, c),
      isActivity: Boolean(c.isActivity),
      detail: [...v.details].join(", "),
    });
    theory += c.theory;
    practice += c.practice;
    credits += c.credits;
  }
  rows.sort((a, b) => a.code.localeCompare(b.code));
  // กิจกรรม (แยกจากคาบสอน)
  const actRows = new Map<string, SummaryRow>();
  for (const act of acts) {
    if (!act.countsAsLoad && kind === "teacher") continue;
    const cur = actRows.get(act.code) ?? { code: act.code, name: act.name, theory: null, practice: null, credits: null, hours: 0, isActivity: true };
    cur.hours += act.length;
    actRows.set(act.code, cur);
  }
  const all = [...rows, ...actRows.values()];
  hours = all.reduce((s, r) => s + r.hours, 0);
  return { summary: all, totals: { theory, practice, credits, hours } };
}

function buildStats(ds: Dataset, slotItems: Map<string, CellItem[]>): GridStats {
  const regularEnd = toMinutes(ds.school.regularEndTime || "16:30");
  let teaching = 0,
    activity = 0,
    free = 0,
    blocks = 0,
    maxPerDay = 0,
    inReg = 0,
    outReg = 0;
  const seenBlocks = new Set<string>();
  for (const day of ds.time.days) {
    let dayCount = 0;
    const busy: boolean[] = [];
    for (const p of ds.time.periods) {
      const items = slotItems.get(`${day.index}:${p.no}`) ?? [];
      const has = items.length > 0;
      busy.push(has);
      if (has) {
        const isLesson = items.some((i) => i.kind === "lesson");
        if (isLesson) teaching++;
        else activity++;
        dayCount++;
        if (toMinutes(p.end) <= regularEnd) inReg++;
        else outReg++;
        for (const it of items) {
          if (it.kind !== "lesson") continue;
          const k = `${it.assignmentId}:${it.block}`;
          if (seenBlocks.has(k)) continue;
          seenBlocks.add(k);
        }
      }
    }
    // คาบว่าง = ช่องว่างคั่นระหว่างคาบแรกและคาบสุดท้ายของวัน
    const first = busy.indexOf(true);
    const last = busy.lastIndexOf(true);
    if (first >= 0) for (let i = first; i <= last; i++) if (!busy[i] && !ds.time.periods[i].isBreak) free++;
    maxPerDay = Math.max(maxPerDay, dayCount);
  }
  // นับ block ต่อเนื่องที่ยาว ≥ 2 คาบ
  for (const k of seenBlocks) {
    const [aid, b] = k.split(":");
    const a = ds.assignments.find((x) => x.id === aid);
    const c = a ? ds.courses.find((x) => x.id === a.courseId) : undefined;
    if (a && (effectiveBlocks(a, c)[Number(b)] ?? 1) >= 2) blocks++;
  }
  return { teachingPeriods: teaching, activityPeriods: activity, freePeriods: free, consecutiveBlocks: blocks, maxPerDay, inRegular: inReg, outRegular: outReg };
}
