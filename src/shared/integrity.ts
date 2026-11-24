/**
 * ตรวจความครบถ้วน/ความถูกต้องเชิงอ้างอิงของชุดข้อมูล (ก่อนจัดตาราง)
 * ใช้ใน Dashboard, การนำเข้า และ API
 */
import { ENTITY_SCHEMAS, TimeStructureSchema, formatZodIssues } from "./schemas";
import { effectivePeriods } from "./slots";
import type { Dataset, EntityKind } from "./types";

export type IssueLevel = "error" | "warning";

export interface DataIssue {
  level: IssueLevel;
  entity: EntityKind | "time" | "school";
  id?: string;
  code?: string;
  field?: string;
  message: string;
}

const KIND_LABEL: Record<EntityKind, string> = {
  courses: "รายวิชา",
  teachers: "ครู",
  rooms: "ห้อง",
  groups: "กลุ่มเรียน",
  students: "นักเรียน",
  assignments: "การมอบหมายสอน",
  activities: "กิจกรรม",
};

export function entityLabel(k: EntityKind): string {
  return KIND_LABEL[k];
}

export function checkDataset(ds: Dataset): DataIssue[] {
  const issues: DataIssue[] = [];

  const t = TimeStructureSchema.safeParse(ds.time);
  if (!t.success) formatZodIssues(t.error).forEach((i) => issues.push({ level: "error", entity: "time", field: i.path, message: i.message }));

  // schema + รหัสซ้ำ
  (Object.keys(ENTITY_SCHEMAS) as EntityKind[]).forEach((kind) => {
    const schema = ENTITY_SCHEMAS[kind];
    const seenCode = new Map<string, string>();
    const seenId = new Set<string>();
    (ds[kind] as { id: string; code?: string }[]).forEach((item) => {
      const r = schema.safeParse(item);
      if (!r.success)
        formatZodIssues(r.error).forEach((i) =>
          issues.push({ level: "error", entity: kind, id: item.id, code: item.code, field: i.path, message: i.message }),
        );
      if (seenId.has(item.id)) issues.push({ level: "error", entity: kind, id: item.id, message: `${KIND_LABEL[kind]} id ซ้ำ: ${item.id}` });
      seenId.add(item.id);
      if (item.code && kind !== "activities") {
        const key = item.code.trim().toUpperCase();
        if (seenCode.has(key))
          issues.push({ level: "error", entity: kind, id: item.id, code: item.code, field: "code", message: `รหัส${KIND_LABEL[kind]}ซ้ำ: ${item.code}` });
        seenCode.set(key, item.id);
      }
    });
  });

  const courseById = new Map(ds.courses.map((c) => [c.id, c]));
  const teacherById = new Map(ds.teachers.map((x) => [x.id, x]));
  const roomById = new Map(ds.rooms.map((x) => [x.id, x]));
  const groupById = new Map(ds.groups.map((x) => [x.id, x]));
  const asgById = new Map(ds.assignments.map((x) => [x.id, x]));
  const P = ds.time.periods.length;

  ds.assignments.forEach((a) => {
    const c = courseById.get(a.courseId);
    const label = c ? c.code : a.id;
    if (!c) issues.push({ level: "error", entity: "assignments", id: a.id, field: "courseId", message: `${a.id}: ไม่พบรายวิชา ${a.courseId}` });
    const tch = teacherById.get(a.teacherId);
    if (!tch) issues.push({ level: "error", entity: "assignments", id: a.id, field: "teacherId", message: `${label}: ไม่พบครู ${a.teacherId}` });
    a.groupIds.forEach((g) => {
      if (!groupById.has(g)) issues.push({ level: "error", entity: "assignments", id: a.id, field: "groupIds", message: `${label}: ไม่พบกลุ่มเรียน ${g}` });
    });
    if (a.fixedRoomId && !roomById.has(a.fixedRoomId))
      issues.push({ level: "error", entity: "assignments", id: a.id, field: "fixedRoomId", message: `${label}: ไม่พบห้อง ${a.fixedRoomId}` });
    if (tch && c && tch.qualifiedCourseIds.length > 0 && !tch.qualifiedCourseIds.includes(c.id))
      issues.push({
        level: "error",
        entity: "assignments",
        id: a.id,
        field: "teacherId",
        message: `${label}: ครู ${tch.firstName} ไม่มีคุณสมบัติสอนวิชานี้ (ไม่อยู่ในรายวิชาที่สอนได้)`,
      });
    if (a.blockSizes && a.periodsPerWeek && a.blockSizes.reduce((s, n) => s + n, 0) !== a.periodsPerWeek)
      issues.push({ level: "error", entity: "assignments", id: a.id, field: "blockSizes", message: `${label}: ผลรวมคาบต่อเนื่องไม่เท่ากับจำนวนคาบ` });
    if (c) {
      const size = a.groupIds.reduce((s, g) => s + (groupById.get(g)?.size ?? 0), 0);
      const fitting = a.fixedRoomId
        ? [roomById.get(a.fixedRoomId)].filter(Boolean)
        : ds.rooms.filter(
            (r) => r.type === c.roomType && r.capacity >= size && c.requiredEquipment.every((e) => r.equipment.includes(e)),
          );
      if (fitting.length === 0)
        issues.push({
          level: "error",
          entity: "assignments",
          id: a.id,
          message: `${label}: ไม่มีห้องที่ตรงเงื่อนไข (ประเภท ${c.roomType}, ความจุ ≥ ${size}${c.requiredEquipment.length ? `, อุปกรณ์ ${c.requiredEquipment.join(", ")}` : ""})`,
        });
    }
  });

  ds.students.forEach((s) => {
    if (!groupById.has(s.groupId)) issues.push({ level: "error", entity: "students", id: s.id, code: s.code, field: "groupId", message: `${s.code}: ไม่พบกลุ่มเรียน ${s.groupId}` });
    s.extraAssignmentIds.forEach((x) => {
      if (!asgById.has(x)) issues.push({ level: "error", entity: "students", id: s.id, code: s.code, message: `${s.code}: ไม่พบรายการมอบหมายสอน ${x}` });
    });
  });

  ds.activities.forEach((a) => {
    if (a.startPeriod + a.length - 1 > P)
      issues.push({ level: "error", entity: "activities", id: a.id, code: a.code, message: `${a.code}: เกินจำนวนคาบต่อวัน` });
    a.teacherIds.forEach((x) => {
      if (!teacherById.has(x)) issues.push({ level: "error", entity: "activities", id: a.id, code: a.code, message: `${a.code}: ไม่พบครู ${x}` });
    });
    a.groupIds.forEach((x) => {
      if (!groupById.has(x)) issues.push({ level: "error", entity: "activities", id: a.id, code: a.code, message: `${a.code}: ไม่พบกลุ่ม ${x}` });
    });
  });

  ds.groups.forEach((g) => {
    if (g.advisorTeacherId && !teacherById.has(g.advisorTeacherId))
      issues.push({ level: "warning", entity: "groups", id: g.id, code: g.code, message: `${g.code}: ไม่พบครูที่ปรึกษา` });
    if (!ds.assignments.some((a) => a.groupIds.includes(g.id)))
      issues.push({ level: "warning", entity: "groups", id: g.id, code: g.code, message: `${g.code}: ยังไม่มีรายการมอบหมายสอน` });
  });

  ds.teachers.forEach((tch) => {
    const load = ds.assignments
      .filter((a) => a.teacherId === tch.id)
      .reduce((s, a) => s + effectivePeriods(a, courseById.get(a.courseId)), 0);
    if (load > tch.maxPerWeek)
      issues.push({ level: "warning", entity: "teachers", id: tch.id, code: tch.code, message: `${tch.code}: ภาระสอน ${load} คาบ เกินสูงสุด ${tch.maxPerWeek} คาบ/สัปดาห์` });
  });

  return issues;
}
