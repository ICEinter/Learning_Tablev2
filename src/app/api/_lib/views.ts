/**
 * สร้าง views ตอนเผยแพร่ (DEVELOPMENT_PLAN 4.4): g_{groupId}, t_{teacherId}, r_{roomId}
 * แต่ละ doc เล็ก ครู/นักเรียนอ่าน 1–3 doc ต่อการเปิดตาราง
 */
import { effectiveBlocks, teacherName } from "@/shared/slots";
import type { Dataset, Placement } from "@/shared/types";

export interface ViewRow {
  d: number; // วัน
  p: number; // คาบเริ่ม
  len: number; // จำนวนคาบต่อเนื่อง
  course: string;
  courseName: string;
  teacher: string;
  groups: string;
  room: string;
  assignmentId: string;
}

export interface ViewDoc {
  kind: "group" | "teacher" | "room";
  refId: string;
  versionId: string;
  rows: ViewRow[];
  summary: { periods: number; blocks: number };
}

export function buildViews(ds: Dataset, placements: Placement[], versionId: string): Map<string, ViewDoc> {
  const assignments = new Map(ds.assignments.map((a) => [a.id, a]));
  const courses = new Map(ds.courses.map((c) => [c.id, c]));
  const teachers = new Map(ds.teachers.map((t) => [t.id, t]));
  const rooms = new Map(ds.rooms.map((r) => [r.id, r]));
  const groups = new Map(ds.groups.map((g) => [g.id, g]));
  const views = new Map<string, ViewDoc>();

  const push = (key: string, kind: ViewDoc["kind"], refId: string, row: ViewRow) => {
    let v = views.get(key);
    if (!v) {
      v = { kind, refId, versionId, rows: [], summary: { periods: 0, blocks: 0 } };
      views.set(key, v);
    }
    v.rows.push(row);
    v.summary.blocks += 1;
    v.summary.periods += row.len;
  };

  for (const p of placements) {
    const a = assignments.get(p.assignmentId);
    if (!a) continue;
    const c = courses.get(a.courseId);
    const t = teachers.get(a.teacherId);
    const len = effectiveBlocks(a, c)[p.block] ?? 1;
    const row: ViewRow = {
      d: p.day,
      p: p.period,
      len,
      course: c?.code ?? "",
      courseName: c?.name ?? "",
      teacher: t ? teacherName(t) : "",
      groups: a.groupIds.map((g) => groups.get(g)?.code ?? g).join(", "),
      room: rooms.get(p.roomId)?.code ?? p.roomId,
      assignmentId: a.id,
    };
    for (const g of a.groupIds) push(`g_${g}`, "group", g, row);
    push(`t_${a.teacherId}`, "teacher", a.teacherId, row);
    push(`r_${p.roomId}`, "room", p.roomId, row);
  }
  for (const v of views.values()) v.rows.sort((x, y) => x.d - y.d || x.p - y.p);
  return views;
}
