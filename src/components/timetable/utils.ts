import type { Violation } from "@/engine/types";
import type { CellItem, GridCell, TimetableGrid, ViewKind } from "@/lib/timetable/viewmodel";
import { newId } from "@/lib/id";
import type { Dataset, ID, Placement, SlotRef, TimetableVersion } from "@/shared/types";

export interface BlockRef {
  assignmentId: ID;
  block: number;
}

export interface TargetInfo {
  ok: boolean;
  reasons: string[];
  okRoomIds: ID[];
}

export const slotKey = (day: number, period: number) => `${day}:${period}`;

export function periodRangeLabel(grid: Pick<TimetableGrid, "periods">, start: number, span: number): string {
  const a = grid.periods[start - 1];
  const b = grid.periods[start + span - 2];
  if (!a || !b) return "";
  return `${a.start} - ${b.end}`;
}

export function periodNoLabel(start: number, span: number): string {
  return span > 1 ? `คาบ ${start}-${start + span - 1}` : `คาบ ${start}`;
}

function itemIds(item: CellItem): Set<string> {
  const s = new Set<string>();
  if (item.assignmentId) s.add(item.assignmentId);
  if (item.activityId) s.add(item.activityId);
  if (item.courseId) s.add(item.courseId);
  if (item.roomId) s.add(item.roomId);
  item.teacherIds.forEach((x) => s.add(x));
  item.groupIds.forEach((x) => s.add(x));
  return s;
}

/** ข้อขัดแย้งที่แตะช่องนี้ (ช่วงเวลาซ้อนกัน และเกี่ยวกับ entity ในช่อง) */
export function violationsForCell(cell: GridCell, violations: Violation[] | undefined): Violation[] {
  if (!violations?.length || cell.items.length === 0) return [];
  const ids = new Set<string>();
  cell.items.forEach((it) => itemIds(it).forEach((x) => ids.add(x)));
  return violations.filter((v) => {
    const slotHit = v.slots.some((s) => s.day === cell.day && s.period >= cell.startPeriod && s.period < cell.startPeriod + cell.span);
    if (!slotHit) return false;
    return v.entities.length === 0 || v.entities.some((e) => ids.has(e.id));
  });
}

/** id ที่เกี่ยวข้องกับ entity ของมุมมอง (ตัว entity เอง + รายการมอบหมายสอน) */
export function relatedIds(ds: Dataset, placements: Placement[], kind: ViewKind, id: ID): Set<string> {
  const out = new Set<string>([id]);
  if (kind === "teacher") ds.assignments.filter((a) => a.teacherId === id).forEach((a) => out.add(a.id));
  if (kind === "group") ds.assignments.filter((a) => a.groupIds.includes(id)).forEach((a) => out.add(a.id));
  if (kind === "course") ds.assignments.filter((a) => a.courseId === id).forEach((a) => out.add(a.id));
  if (kind === "room") placements.filter((p) => p.roomId === id).forEach((p) => out.add(p.assignmentId));
  if (kind === "student") {
    const s = ds.students.find((x) => x.id === id);
    if (s) {
      out.add(s.groupId);
      ds.assignments.filter((a) => a.groupIds.includes(s.groupId)).forEach((a) => out.add(a.id));
      s.extraAssignmentIds.forEach((x) => out.add(x));
    }
  }
  return out;
}

/** ช่องที่มีข้อขัดแย้ง Hard ที่เกี่ยวกับ entity นี้ (ใช้กับ buildGrid conflictSlots) */
export function conflictSlotsFor(ds: Dataset, placements: Placement[], violations: Violation[], kind: ViewKind, id: ID): SlotRef[] {
  const ids = relatedIds(ds, placements, kind, id);
  const out: SlotRef[] = [];
  for (const v of violations) {
    if (v.severity !== "hard") continue;
    if (!v.entities.some((e) => ids.has(e.id))) continue;
    out.push(...v.slots);
  }
  return out;
}

/** เลือก entity ที่ดูได้จากข้อขัดแย้ง (ใช้โฟกัสมุมมอง) */
export function focusTarget(ds: Dataset, v: Violation): { kind: ViewKind; id: ID } | null {
  const order: ViewKind[] = ["teacher", "group", "room", "student", "course"];
  for (const k of order) {
    const e = v.entities.find((x) => x.kind === k);
    if (e) return { kind: k, id: e.id };
  }
  const asg = v.entities.find((x) => x.kind === "assignment");
  if (asg) {
    const a = ds.assignments.find((x) => x.id === asg.id);
    if (a) return { kind: "teacher", id: a.teacherId };
  }
  return null;
}

export function sameBlock(a: BlockRef | null | undefined, item: CellItem): boolean {
  return Boolean(a && item.kind === "lesson" && item.assignmentId === a.assignmentId && item.block === a.block);
}

/** สร้างสำเนาเวอร์ชันตารางเป็นร่างใหม่ */
export function duplicateAsDraft(tt: TimetableVersion, label?: string): TimetableVersion {
  const now = new Date().toISOString();
  return {
    ...tt,
    id: newId("tt"),
    label: label ?? `${tt.label} (สำเนา)`,
    status: "draft",
    placements: tt.placements.map((p) => ({ ...p })),
    createdAt: now,
    updatedAt: now,
    publishedAt: undefined,
    note: `สำเนาจาก "${tt.label}"`,
  };
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export const STATUS_TEXT: Record<TimetableVersion["status"], string> = { draft: "ร่าง", published: "เผยแพร่", archived: "เก็บถาวร" };
export const STATUS_TONE: Record<TimetableVersion["status"], "neutral" | "ok" | "warn"> = { draft: "warn", published: "ok", archived: "neutral" };
