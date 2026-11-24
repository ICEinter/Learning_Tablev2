/**
 * ตัวช่วยสำหรับ "ตารางรวม" (overview) — รายการคาบแบบแบน + เมทริกซ์ + แปลงเป็น ReportTable
 * (ไม่มี React — ใช้ได้ทั้งหน้าจอและ export)
 */
import { effectiveBlocks, teacherName } from "@/shared/slots";
import type { Dataset, ID, Placement } from "@/shared/types";
import { buildLookup, type ViewKind } from "./viewmodel";

export interface OverviewEntry {
  key: string;
  kind: "lesson" | "activity";
  day: number;
  dayLabel: string;
  startPeriod: number;
  length: number;
  timeLabel: string;
  assignmentId?: ID;
  block?: number;
  activityId?: ID;
  courseId?: ID;
  courseCode: string;
  courseName: string;
  teacherIds: ID[];
  teacherLabel: string;
  groupIds: ID[];
  groupLabel: string;
  roomId?: ID;
  roomLabel: string;
}

export interface OverviewFilter {
  day?: number | null;
  teacherId?: ID | null;
  groupId?: ID | null;
  roomId?: ID | null;
  courseId?: ID | null;
  text?: string;
}

function timeRange(ds: Dataset, start: number, length: number): string {
  const a = ds.time.periods[start - 1];
  const b = ds.time.periods[start + length - 2];
  if (!a || !b) return "";
  return `${a.start} - ${b.end}`;
}

/** รายการคาบทั้งหมด (คาบสอน + กิจกรรมล็อก) เรียงตาม วัน → คาบ → รหัสวิชา */
export function buildOverview(ds: Dataset, placements: Placement[], includeActivities = true): OverviewEntry[] {
  const L = buildLookup(ds);
  const dayLabel = new Map(ds.time.days.map((d) => [d.index, d.label]));
  const out: OverviewEntry[] = [];
  for (const pl of placements) {
    const a = L.assignment.get(pl.assignmentId);
    if (!a) continue;
    const c = L.course.get(a.courseId);
    const len = effectiveBlocks(a, c)[pl.block] ?? 1;
    const t = L.teacher.get(a.teacherId);
    const r = L.room.get(pl.roomId);
    out.push({
      key: `L:${pl.assignmentId}:${pl.block}`,
      kind: "lesson",
      day: pl.day,
      dayLabel: dayLabel.get(pl.day) ?? String(pl.day),
      startPeriod: pl.period,
      length: len,
      timeLabel: timeRange(ds, pl.period, len),
      assignmentId: a.id,
      block: pl.block,
      courseId: a.courseId,
      courseCode: c?.code ?? a.courseId,
      courseName: c?.name ?? "",
      teacherIds: [a.teacherId],
      teacherLabel: t ? teacherName(t) : a.teacherId,
      groupIds: a.groupIds,
      groupLabel: a.groupIds.map((g) => L.group.get(g)?.code ?? g).join(", "),
      roomId: pl.roomId,
      roomLabel: r?.code ?? pl.roomId,
    });
  }
  if (includeActivities) {
    for (const act of ds.activities) {
      const r = act.roomId ? L.room.get(act.roomId) : undefined;
      out.push({
        key: `A:${act.id}`,
        kind: "activity",
        day: act.day,
        dayLabel: dayLabel.get(act.day) ?? String(act.day),
        startPeriod: act.startPeriod,
        length: act.length,
        timeLabel: timeRange(ds, act.startPeriod, act.length),
        activityId: act.id,
        courseCode: act.code,
        courseName: act.name,
        teacherIds: act.teacherIds,
        teacherLabel: act.appliesToAll
          ? "ครูทุกคน"
          : act.teacherIds.map((id) => {
              const t = L.teacher.get(id);
              return t ? teacherName(t) : id;
            }).join(", "),
        groupIds: act.groupIds,
        groupLabel: act.appliesToAll ? "ทุกกลุ่ม" : act.groupIds.map((g) => L.group.get(g)?.code ?? g).join(", "),
        roomId: act.roomId,
        roomLabel: r?.code ?? "",
      });
    }
  }
  out.sort((x, y) => x.day - y.day || x.startPeriod - y.startPeriod || x.courseCode.localeCompare(y.courseCode));
  return out;
}

export function filterOverview(entries: OverviewEntry[], f: OverviewFilter): OverviewEntry[] {
  const text = (f.text ?? "").trim().toLowerCase();
  return entries.filter((e) => {
    if (f.day != null && e.day !== f.day) return false;
    if (f.teacherId && !e.teacherIds.includes(f.teacherId)) return false;
    if (f.groupId && !e.groupIds.includes(f.groupId) && e.groupLabel !== "ทุกกลุ่ม") return false;
    if (f.roomId && e.roomId !== f.roomId) return false;
    if (f.courseId && e.courseId !== f.courseId) return false;
    if (text) {
      const hay = `${e.courseCode} ${e.courseName} ${e.teacherLabel} ${e.groupLabel} ${e.roomLabel} ${e.dayLabel}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

export type MatrixAxis = "group" | "teacher" | "room";

export interface OverviewMatrix {
  axis: MatrixAxis;
  rows: { id: ID; label: string }[];
  days: { index: number; label: string; short: string }[];
  periods: number[];
  /** key = `${rowId}:${day}:${period}` → รหัสวิชา/กิจกรรม */
  cells: Map<string, { codes: string[]; activity: boolean; clash: boolean }>;
}

/** เมทริกซ์ แถว = กลุ่ม/ครู/ห้อง × คอลัมน์ = (วัน, คาบ) — เฉพาะวันที่เปิด */
export function buildMatrix(ds: Dataset, entries: OverviewEntry[], axis: MatrixAxis): OverviewMatrix {
  const rows =
    axis === "group"
      ? ds.groups.map((g) => ({ id: g.id, label: g.code }))
      : axis === "teacher"
        ? ds.teachers.map((t) => ({ id: t.id, label: `${t.prefix}${t.firstName}` }))
        : ds.rooms.map((r) => ({ id: r.id, label: r.code }));
  const allIds = rows.map((r) => r.id);
  const cells: OverviewMatrix["cells"] = new Map();
  for (const e of entries) {
    let ids: ID[];
    if (axis === "group") ids = e.groupLabel === "ทุกกลุ่ม" ? allIds : e.groupIds;
    else if (axis === "teacher") ids = e.teacherLabel === "ครูทุกคน" ? allIds : e.teacherIds;
    else ids = e.roomId ? [e.roomId] : [];
    for (const id of ids) {
      for (let i = 0; i < e.length; i++) {
        const k = `${id}:${e.day}:${e.startPeriod + i}`;
        const cur = cells.get(k) ?? { codes: [], activity: true, clash: false };
        cur.codes.push(e.courseCode);
        if (e.kind === "lesson") cur.activity = false;
        cur.clash = cur.codes.length > 1;
        cells.set(k, cur);
      }
    }
  }
  return {
    axis,
    rows,
    days: ds.time.days.filter((d) => d.active).map((d) => ({ index: d.index, label: d.label, short: d.short })),
    periods: ds.time.periods.map((p) => p.no),
    cells,
  };
}

/** ตารางรวมแบบรายการ → ReportTable (ใช้ export PDF/Excel ตามตัวกรองปัจจุบัน) */
export function overviewReport(entries: OverviewEntry[], subtitle?: string) {
  return {
    id: "overview",
    title: "ตารางรวม (รายการคาบ)",
    subtitle,
    columns: [
      { key: "day", label: "วัน" },
      { key: "periods", label: "คาบ", align: "center" as const },
      { key: "time", label: "เวลา", align: "center" as const },
      { key: "code", label: "รหัสวิชา" },
      { key: "name", label: "ชื่อรายวิชา/กิจกรรม" },
      { key: "teacher", label: "ผู้สอน" },
      { key: "groups", label: "กลุ่มเรียน" },
      { key: "room", label: "ห้อง", align: "center" as const },
    ],
    rows: entries.map((e) => ({
      day: e.dayLabel,
      periods: e.length > 1 ? `${e.startPeriod}-${e.startPeriod + e.length - 1}` : String(e.startPeriod),
      time: e.timeLabel,
      code: e.courseCode,
      name: e.courseName,
      teacher: e.teacherLabel,
      groups: e.groupLabel,
      room: e.roomLabel,
    })),
    footnote: `รวม ${entries.length} รายการ`,
  };
}

/** entity ที่ placement นี้เกี่ยวข้อง สำหรับมุมมองที่กำหนด (ใช้โฟกัสจากรายการข้อขัดแย้ง) */
export function viewKindForEntity(kind: string): ViewKind | null {
  if (kind === "teacher" || kind === "room" || kind === "group" || kind === "student" || kind === "course") return kind;
  return null;
}

/** ชื่อไฟล์ที่ปลอดภัย (ตัดอักขระต้องห้ามของระบบไฟล์) */
export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_");
}

/** รหัสสั้นของ entity สำหรับชื่อไฟล์ */
export function entityCode(ds: Dataset, kind: ViewKind, id: ID): string {
  switch (kind) {
    case "teacher":
      return ds.teachers.find((x) => x.id === id)?.code ?? id;
    case "room":
      return ds.rooms.find((x) => x.id === id)?.code ?? id;
    case "group":
      return ds.groups.find((x) => x.id === id)?.code ?? id;
    case "student":
      return ds.students.find((x) => x.id === id)?.code ?? id;
    case "course":
      return ds.courses.find((x) => x.id === id)?.code ?? id;
  }
}

export const GRID_FILE_PREFIX: Record<ViewKind, string> = {
  teacher: "ตารางสอน",
  room: "ตารางการใช้ห้อง",
  group: "ตารางเรียน",
  student: "ตารางเรียน",
  course: "ตารางรายวิชา",
};

/** ชื่อไฟล์ (ไม่รวมนามสกุล) เช่น ตารางสอน-T05-2_2569 */
export function gridFileBase(ds: Dataset, kind: ViewKind, id: ID | null): string {
  const term = `${ds.term.term}_${ds.term.year}`;
  return safeFileName(id ? `${GRID_FILE_PREFIX[kind]}-${entityCode(ds, kind, id)}-${term}` : `${GRID_FILE_PREFIX[kind]}-ทั้งหมด-${term}`);
}
