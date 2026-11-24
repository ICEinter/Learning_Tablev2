/**
 * รายงานสรุป (pure TS) — ภาระงานครู, คาบว่าง, การใช้ห้อง, ข้อขัดแย้ง, ตารางรวม
 * ไม่ import engine: ข้อขัดแย้งรับเข้ามาจากผล validate() ของ engine
 */
import { effectiveBlocks, effectivePeriods, teacherName, toMinutes } from "@/shared/slots";
import type { Assignment, Course, Dataset, LockedActivity, Placement, SlotRef } from "@/shared/types";
import { ROOM_TYPE_LABEL } from "@/shared/types";
import { formatSlotList } from "@/lib/import/slots-format";
import type { ReportTable } from "./types";

export type { ReportColumn, ReportTable } from "./types";

interface Ctx {
  ds: Dataset;
  course: Map<string, Course>;
  assignment: Map<string, Assignment>;
  activeDays: Dataset["time"]["days"];
  teachable: number[]; // เลขคาบที่ไม่ใช่คาบพัก
  regularEnd: number;
  periodEnd: Map<number, number>;
}

function makeCtx(ds: Dataset): Ctx {
  return {
    ds,
    course: new Map(ds.courses.map((c) => [c.id, c])),
    assignment: new Map(ds.assignments.map((a) => [a.id, a])),
    activeDays: ds.time.days.filter((d) => d.active),
    teachable: ds.time.periods.filter((p) => !p.isBreak).map((p) => p.no),
    regularEnd: toMinutes(ds.school.regularEndTime || "16:30"),
    periodEnd: new Map(ds.time.periods.map((p) => [p.no, toMinutes(p.end)])),
  };
}

/** ช่วงคาบที่ placement ครอบคลุม */
function placementSlots(ctx: Ctx, pl: Placement): SlotRef[] {
  const a = ctx.assignment.get(pl.assignmentId);
  if (!a) return [];
  const len = effectiveBlocks(a, ctx.course.get(a.courseId))[pl.block] ?? 1;
  return Array.from({ length: len }, (_, i) => ({ day: pl.day, period: pl.period + i }));
}

function activitySlots(act: LockedActivity): SlotRef[] {
  return Array.from({ length: act.length }, (_, i) => ({ day: act.day, period: act.startPeriod + i }));
}

const sk = (s: SlotRef) => `${s.day}:${s.period}`;

/** คาบว่างคั่นในแต่ละวัน: ช่องที่ไม่ใช่คาบพักระหว่างคาบแรกและคาบสุดท้ายที่มีกิจกรรม */
function gapsByDay(ctx: Ctx, busy: Set<string>): Map<number, number> {
  const out = new Map<number, number>();
  for (const d of ctx.ds.time.days) {
    const ps = ctx.ds.time.periods.map((p) => p.no).filter((no) => busy.has(`${d.index}:${no}`));
    if (ps.length === 0) {
      out.set(d.index, 0);
      continue;
    }
    const first = Math.min(...ps);
    const last = Math.max(...ps);
    let g = 0;
    for (const p of ctx.ds.time.periods) if (p.no > first && p.no < last && !p.isBreak && !busy.has(`${d.index}:${p.no}`)) g++;
    out.set(d.index, g);
  }
  return out;
}

function freeSlots(ctx: Ctx, busy: Set<string>, unavailable: SlotRef[] = []): number {
  const un = new Set(unavailable.map(sk));
  let n = 0;
  for (const d of ctx.activeDays)
    for (const p of ctx.teachable) {
      const k = `${d.index}:${p}`;
      if (!busy.has(k) && !un.has(k)) n++;
    }
  return n;
}

function teacherActivities(ds: Dataset, teacherId: string): LockedActivity[] {
  return ds.activities.filter((a) => a.appliesToAll || a.teacherIds.includes(teacherId));
}

function groupActivities(ds: Dataset, groupId: string): LockedActivity[] {
  return ds.activities.filter((a) => a.appliesToAll || a.groupIds.includes(groupId));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------

export function teacherLoadReport(ds: Dataset, placements: Placement[]): ReportTable {
  const ctx = makeCtx(ds);
  const rows = ds.teachers.map((t) => {
    const asgs = ds.assignments.filter((a) => a.teacherId === t.id);
    const asgIds = new Set(asgs.map((a) => a.id));
    const assigned = asgs.reduce((s, a) => s + effectivePeriods(a, ctx.course.get(a.courseId)), 0);
    const lessonSlots = placements.filter((p) => asgIds.has(p.assignmentId)).flatMap((p) => placementSlots(ctx, p));
    const acts = teacherActivities(ds, t.id);
    const loadActSlots = acts.filter((a) => a.countsAsLoad).flatMap(activitySlots);
    const scheduled = lessonSlots.length;
    const activity = loadActSlots.length;
    const total = scheduled + activity;
    const perDay = new Map<number, number>();
    let inReg = 0;
    let outReg = 0;
    for (const s of [...lessonSlots, ...loadActSlots]) {
      perDay.set(s.day, (perDay.get(s.day) ?? 0) + 1);
      if ((ctx.periodEnd.get(s.period) ?? 0) <= ctx.regularEnd) inReg++;
      else outReg++;
    }
    const maxDay = Math.max(0, ...perDay.values());
    const busy = new Set([...lessonSlots, ...acts.flatMap(activitySlots)].map(sk));
    const gaps = [...gapsByDay(ctx, busy).values()].reduce((s, n) => s + n, 0);
    let status = "ปกติ";
    if (total > t.maxPerWeek || maxDay > t.maxPerDay) status = "เกิน";
    else if (scheduled < assigned) status = "ยังจัดไม่ครบ";
    return {
      code: t.code,
      name: teacherName(t),
      position: t.position,
      department: t.department ?? "-",
      assigned,
      scheduled,
      activity,
      total,
      maxPerWeek: t.maxPerWeek,
      maxDay,
      inRegular: inReg,
      outRegular: outReg,
      gaps,
      status,
    };
  });
  rows.sort((a, b) => a.code.localeCompare(b.code));
  return {
    id: "teacher-load",
    title: "รายงานภาระงานสอนรายบุคคล",
    subtitle: `ภาคเรียน ${ds.term.term}/${ds.term.year}`,
    columns: [
      { key: "code", label: "รหัส", width: 8 },
      { key: "name", label: "ชื่อ-สกุล", width: 24 },
      { key: "position", label: "ตำแหน่ง", width: 14 },
      { key: "department", label: "แผนกวิชา", width: 22 },
      { key: "assigned", label: "คาบที่มอบหมาย", numeric: true, align: "right", width: 9 },
      { key: "scheduled", label: "คาบที่จัดแล้ว", numeric: true, align: "right", width: 9 },
      { key: "activity", label: "กิจกรรม (ชม.)", numeric: true, align: "right", width: 8 },
      { key: "total", label: "รวม (ชม.)", numeric: true, align: "right", width: 8 },
      { key: "maxPerWeek", label: "สูงสุด/สัปดาห์", numeric: true, align: "right", width: 8 },
      { key: "maxDay", label: "มากสุด/วัน", numeric: true, align: "right", width: 8 },
      { key: "inRegular", label: "ในเวลา", numeric: true, align: "right", width: 7 },
      { key: "outRegular", label: "นอกเวลา", numeric: true, align: "right", width: 7 },
      { key: "gaps", label: "คาบว่างคั่น", numeric: true, align: "right", width: 8 },
      { key: "status", label: "สถานะ", align: "center", width: 11 },
    ],
    rows,
    footnote: `รวม = คาบที่จัดแล้ว + กิจกรรมที่นับเป็นภาระงาน; "เกิน" เมื่อรวมเกินสูงสุด/สัปดาห์ หรือมากสุด/วันเกินสูงสุดต่อวันของครู; ในเวลา = คาบที่สิ้นสุดไม่เกิน ${ds.school.regularEndTime || "16:30"} น.`,
  };
}

export function freePeriodsReport(ds: Dataset, placements: Placement[]): ReportTable {
  const ctx = makeCtx(ds);
  const rows: Record<string, string | number>[] = [];
  const pushRow = (type: string, code: string, name: string, busy: Set<string>, unavailable?: SlotRef[]) => {
    const g = gapsByDay(ctx, busy);
    const row: Record<string, string | number> = { type, code, name };
    let total = 0;
    for (const d of ctx.activeDays) {
      const n = g.get(d.index) ?? 0;
      row[`d${d.index}`] = n;
      total += n;
    }
    row.totalGaps = total;
    row.freeSlots = freeSlots(ctx, busy, unavailable);
    rows.push(row);
  };
  for (const t of [...ds.teachers].sort((a, b) => a.code.localeCompare(b.code))) {
    const asgIds = new Set(ds.assignments.filter((a) => a.teacherId === t.id).map((a) => a.id));
    const busy = new Set(
      [...placements.filter((p) => asgIds.has(p.assignmentId)).flatMap((p) => placementSlots(ctx, p)), ...teacherActivities(ds, t.id).flatMap(activitySlots)].map(sk),
    );
    pushRow("ครู", t.code, teacherName(t), busy, t.unavailable);
  }
  for (const g of [...ds.groups].sort((a, b) => a.code.localeCompare(b.code))) {
    const asgIds = new Set(ds.assignments.filter((a) => a.groupIds.includes(g.id)).map((a) => a.id));
    const busy = new Set(
      [...placements.filter((p) => asgIds.has(p.assignmentId)).flatMap((p) => placementSlots(ctx, p)), ...groupActivities(ds, g.id).flatMap(activitySlots)].map(sk),
    );
    pushRow("กลุ่มเรียน", g.code, g.name, busy);
  }
  return {
    id: "free-periods",
    title: "รายงานคาบว่าง",
    subtitle: `ภาคเรียน ${ds.term.term}/${ds.term.year}`,
    columns: [
      { key: "type", label: "ประเภท", width: 10 },
      { key: "code", label: "รหัส", width: 10 },
      { key: "name", label: "ชื่อ", width: 34 },
      ...ctx.activeDays.map((d) => ({ key: `d${d.index}`, label: `ว่างคั่น ${d.short}`, numeric: true, align: "right" as const, width: 8 })),
      { key: "totalGaps", label: "ว่างคั่นรวม", numeric: true, align: "right", width: 9 },
      { key: "freeSlots", label: "คาบว่างที่จัดได้", numeric: true, align: "right", width: 10 },
    ],
    rows,
    footnote: "คาบว่างคั่น = ช่องว่าง (ไม่รวมคาบพัก) ระหว่างคาบแรกและคาบสุดท้ายของวัน; คาบว่างที่จัดได้ = ช่องในวันที่เปิดสอนที่ยังไม่มีคาบ/กิจกรรม และไม่อยู่ในเวลาที่ครูไม่ว่าง",
  };
}

export function roomUtilizationReport(ds: Dataset, placements: Placement[]): ReportTable {
  const ctx = makeCtx(ds);
  const rows = ds.rooms.map((r) => {
    const used = new Set<string>();
    placements.filter((p) => p.roomId === r.id).forEach((p) => placementSlots(ctx, p).forEach((s) => used.add(sk(s))));
    ds.activities.filter((a) => a.roomId === r.id).forEach((a) => activitySlots(a).forEach((s) => used.add(sk(s))));
    const un = new Set(r.unavailable.map(sk));
    let available = 0;
    let usedInAvail = 0;
    for (const d of ctx.activeDays)
      for (const p of ctx.teachable) {
        const k = `${d.index}:${p}`;
        if (un.has(k)) continue;
        available++;
        if (used.has(k)) usedInAvail++;
      }
    const perDay = new Map<number, number>();
    for (const k of used) {
      const day = Number(k.split(":")[0]);
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
    let busiest = "-";
    let best = 0;
    for (const d of ds.time.days) {
      const n = perDay.get(d.index) ?? 0;
      if (n > best) {
        best = n;
        busiest = `${d.label} (${n})`;
      }
    }
    return {
      code: r.code,
      name: r.name,
      type: ROOM_TYPE_LABEL[r.type] ?? r.type,
      capacity: r.capacity,
      used: used.size,
      available,
      utilization: available ? round1((usedInAvail / available) * 100) : 0,
      busiestDay: busiest,
    };
  });
  return {
    id: "room-utilization",
    title: "รายงานการใช้ห้อง",
    subtitle: `ภาคเรียน ${ds.term.term}/${ds.term.year}`,
    columns: [
      { key: "code", label: "รหัสห้อง", width: 12 },
      { key: "name", label: "ชื่อห้อง", width: 32 },
      { key: "type", label: "ประเภท", width: 24 },
      { key: "capacity", label: "ความจุ", numeric: true, align: "right", width: 8 },
      { key: "used", label: "คาบที่ใช้", numeric: true, align: "right", width: 8 },
      { key: "available", label: "คาบที่ใช้ได้", numeric: true, align: "right", width: 9 },
      { key: "utilization", label: "อัตราการใช้ (%)", numeric: true, align: "right", width: 10 },
      { key: "busiestDay", label: "วันที่ใช้มากที่สุด", width: 18 },
    ],
    rows,
    footnote: "คาบที่ใช้ได้ = วันที่เปิดสอน × คาบที่ไม่ใช่คาบพัก − ช่วงที่ห้องไม่พร้อมใช้งาน; อัตราการใช้คิดเฉพาะคาบที่ใช้ได้",
  };
}

type ConflictInput = {
  type: string;
  severity: "hard" | "soft";
  message: string;
  entities: { kind: string; id: string }[];
  slots: { day: number; period: number }[];
};

function entityLabel(ds: Dataset, kind: string, id: string): string {
  const k = kind.replace(/s$/, "");
  switch (k) {
    case "teacher": {
      const t = ds.teachers.find((x) => x.id === id);
      return t ? `ครู ${teacherName(t)}` : `ครู ${id}`;
    }
    case "room":
      return `ห้อง ${ds.rooms.find((x) => x.id === id)?.code ?? id}`;
    case "group":
      return `กลุ่ม ${ds.groups.find((x) => x.id === id)?.code ?? id}`;
    case "course":
      return `วิชา ${ds.courses.find((x) => x.id === id)?.code ?? id}`;
    case "student": {
      const s = ds.students.find((x) => x.id === id);
      return s ? `นักเรียน ${s.code}` : `นักเรียน ${id}`;
    }
    case "assignment": {
      const a = ds.assignments.find((x) => x.id === id);
      if (!a) return `รายการสอน ${id}`;
      const c = ds.courses.find((x) => x.id === a.courseId);
      const gs = a.groupIds.map((g) => ds.groups.find((x) => x.id === g)?.code ?? g).join(",");
      return `${c?.code ?? a.courseId}@${gs}`;
    }
    case "activity":
      return `กิจกรรม ${ds.activities.find((x) => x.id === id)?.code ?? id}`;
    default:
      return `${kind} ${id}`;
  }
}

export function conflictReport(ds: Dataset, violations: ConflictInput[]): ReportTable {
  const shorts = ds.time.days.map((d) => d.short);
  const sorted = [...violations].sort((a, b) => (a.severity === b.severity ? a.type.localeCompare(b.type) : a.severity === "hard" ? -1 : 1));
  const rows = sorted.map((v, i) => ({
    no: i + 1,
    severity: v.severity === "hard" ? "ต้องแก้ (Hard)" : "ควรปรับ (Soft)",
    type: v.type,
    message: v.message,
    entities: [...new Set(v.entities.map((e) => entityLabel(ds, e.kind, e.id)))].join(", "),
    slots: formatSlotList(v.slots, shorts) || "-",
  }));
  const hard = violations.filter((v) => v.severity === "hard").length;
  return {
    id: "conflicts",
    title: "รายงานข้อขัดแย้ง",
    subtitle: `ภาคเรียน ${ds.term.term}/${ds.term.year} — Hard ${hard} รายการ, Soft ${violations.length - hard} รายการ`,
    columns: [
      { key: "no", label: "ลำดับ", numeric: true, align: "center", width: 6 },
      { key: "severity", label: "ระดับ", width: 13 },
      { key: "type", label: "ประเภท", width: 16 },
      { key: "message", label: "รายละเอียด", width: 50 },
      { key: "entities", label: "ที่เกี่ยวข้อง", width: 30 },
      { key: "slots", label: "ช่วงเวลา", width: 14 },
    ],
    rows,
    footnote: violations.length === 0 ? "ไม่พบข้อขัดแย้ง" : "Hard = ต้องแก้ก่อนเผยแพร่; Soft = ข้อควรปรับเพื่อคุณภาพตาราง",
  };
}

export function placementListReport(ds: Dataset, placements: Placement[]): ReportTable {
  const ctx = makeCtx(ds);
  const dayBy = new Map(ds.time.days.map((d) => [d.index, d]));
  const items = placements
    .map((pl) => {
      const a = ctx.assignment.get(pl.assignmentId);
      const c = a ? ctx.course.get(a.courseId) : undefined;
      const len = a ? (effectiveBlocks(a, c)[pl.block] ?? 1) : 1;
      const last = pl.period + len - 1;
      const p1 = ds.time.periods[pl.period - 1];
      const p2 = ds.time.periods[last - 1];
      const t = a ? ds.teachers.find((x) => x.id === a.teacherId) : undefined;
      return {
        sortDay: pl.day,
        sortPeriod: pl.period,
        row: {
          day: dayBy.get(pl.day)?.label ?? String(pl.day),
          periods: len > 1 ? `${pl.period}-${last}` : `${pl.period}`,
          time: p1 && p2 ? `${p1.start} - ${p2.end}` : "-",
          courseCode: c?.code ?? a?.courseId ?? pl.assignmentId,
          courseName: c?.name ?? "",
          groups: a ? a.groupIds.map((g) => ds.groups.find((x) => x.id === g)?.code ?? g).join(", ") : "-",
          teacher: t ? teacherName(t) : (a?.teacherId ?? "-"),
          room: ds.rooms.find((r) => r.id === pl.roomId)?.code ?? pl.roomId,
        },
      };
    })
    .sort(
      (x, y) =>
        x.sortDay - y.sortDay ||
        x.sortPeriod - y.sortPeriod ||
        String(x.row.courseCode).localeCompare(String(y.row.courseCode)) ||
        x.row.groups.localeCompare(y.row.groups),
    );
  return {
    id: "placements",
    title: "ตารางรวม",
    subtitle: `ภาคเรียน ${ds.term.term}/${ds.term.year} — ${items.length} ช่วงคาบ`,
    columns: [
      { key: "day", label: "วัน", width: 12 },
      { key: "periods", label: "คาบ", align: "center", width: 6 },
      { key: "time", label: "เวลา", align: "center", width: 13 },
      { key: "courseCode", label: "รหัสวิชา", width: 12 },
      { key: "courseName", label: "ชื่อรายวิชา", width: 38 },
      { key: "groups", label: "กลุ่มเรียน", width: 18 },
      { key: "teacher", label: "ผู้สอน", width: 22 },
      { key: "room", label: "ห้อง", width: 12 },
    ],
    rows: items.map((x) => x.row),
  };
}
