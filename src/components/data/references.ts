/**
 * ตรวจการอ้างอิงก่อนลบ — ห้ามลบข้อมูลที่ยังถูกอ้างอิงอยู่ (DEVELOPMENT_PLAN 4.5)
 */
import { teacherName } from "@/shared/slots";
import type { Dataset, EntityKind, TimetableVersion } from "@/shared/types";

export interface ReferenceReport {
  /** การอ้างอิงที่ทำให้ลบไม่ได้ */
  blocking: string[];
  /** ข้อควรทราบ (ไม่บล็อก) */
  warnings: string[];
}

export function findReferences(ds: Dataset, timetables: TimetableVersion[], kind: EntityKind, id: string): ReferenceReport {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const courseCode = (cid: string) => ds.courses.find((c) => c.id === cid)?.code ?? cid;
  const asgLabel = (aid: string) => {
    const a = ds.assignments.find((x) => x.id === aid);
    if (!a) return aid;
    const groups = a.groupIds.map((g) => ds.groups.find((x) => x.id === g)?.code ?? g).join(", ");
    return `${courseCode(a.courseId)} (${groups})`;
  };

  switch (kind) {
    case "courses":
      ds.assignments.filter((a) => a.courseId === id).forEach((a) => blocking.push(`การมอบหมายสอน: ${asgLabel(a.id)}`));
      ds.teachers.filter((t) => t.qualifiedCourseIds.includes(id)).forEach((t) => blocking.push(`รายวิชาที่สอนได้ของครู: ${teacherName(t)}`));
      break;
    case "teachers":
      ds.assignments.filter((a) => a.teacherId === id).forEach((a) => blocking.push(`การมอบหมายสอน: ${asgLabel(a.id)}`));
      ds.activities.filter((a) => a.teacherIds.includes(id)).forEach((a) => blocking.push(`กิจกรรม: ${a.code}`));
      ds.groups.filter((g) => g.advisorTeacherId === id).forEach((g) => blocking.push(`ครูที่ปรึกษากลุ่ม: ${g.code}`));
      break;
    case "rooms":
      ds.assignments.filter((a) => a.fixedRoomId === id).forEach((a) => blocking.push(`ห้องบังคับของการมอบหมายสอน: ${asgLabel(a.id)}`));
      ds.activities.filter((a) => a.roomId === id).forEach((a) => blocking.push(`ห้องของกิจกรรม: ${a.code}`));
      break;
    case "groups":
      ds.assignments.filter((a) => a.groupIds.includes(id)).forEach((a) => blocking.push(`การมอบหมายสอน: ${asgLabel(a.id)}`));
      ds.students.filter((s) => s.groupId === id).forEach((s) => blocking.push(`นักเรียน: ${s.code} ${s.displayName}`));
      ds.activities.filter((a) => a.groupIds.includes(id)).forEach((a) => blocking.push(`กิจกรรม: ${a.code}`));
      break;
    case "assignments":
      ds.students.filter((s) => s.extraAssignmentIds.includes(id)).forEach((s) => blocking.push(`นักเรียนลงเพิ่ม: ${s.code} ${s.displayName}`));
      break;
    default:
      break;
  }

  if (kind === "assignments" || kind === "rooms") {
    const used = timetables.filter((t) =>
      t.placements.some((p) => (kind === "assignments" ? p.assignmentId === id : p.roomId === id)),
    );
    if (used.length)
      warnings.push(`ตารางสอน ${used.length} ฉบับมีคาบที่ใช้รายการนี้ (${used.map((t) => t.label).join(", ")}) — ฉบับเหล่านั้นจะต้องจัดใหม่/ตรวจซ้ำ`);
  }
  return { blocking, warnings };
}
