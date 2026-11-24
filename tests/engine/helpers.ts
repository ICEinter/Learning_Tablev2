import type { Dataset, Placement } from "@/shared/types";
import type { ValidationResult } from "@/engine";

/**
 * ชุดข้อมูลจิ๋วสำหรับทดสอบทีละกฎ
 * - เปิด 2 วัน (จ., อ.) คาบ 1–5, คาบ 3 = พัก, คาบ 5 จบ 17:00 (เกิน 16:30 → นอกเวลาราชการ)
 * - a1: c1 (บรรยาย 1 คาบ) ครู t1 กลุ่ม g1   a2: c2 (คอมพิวเตอร์ 2 คาบต่อเนื่อง) ครู t2 กลุ่ม g2
 * ตารางสะอาด: a1 จ. คาบ1 ห้อง r1, a2 จ. คาบ1–2 ห้อง r2
 */
export function tiny(): { ds: Dataset; pl: Placement[] } {
  const days = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."].map((short, i) => ({ index: i, label: `วัน${short}`, short, active: i < 2 }));
  const ds: Dataset = {
    school: { id: "s", name: "ทดสอบ", signatories: [], regularEndTime: "16:30" },
    term: { id: "t", year: "2569", term: "1", status: "setup" },
    time: {
      days,
      periods: [
        { no: 1, start: "08:00", end: "09:00" },
        { no: 2, start: "09:00", end: "10:00" },
        { no: 3, start: "10:00", end: "11:00", isBreak: true },
        { no: 4, start: "11:00", end: "12:00" },
        { no: 5, start: "16:00", end: "17:00" },
      ],
    },
    courses: [
      { id: "c1", code: "C1", name: "บรรยาย", theory: 1, practice: 0, credits: 1, periodsPerWeek: 1, blockSizes: [1], roomType: "lecture", requiredEquipment: [] },
      { id: "c2", code: "C2", name: "คอมพิวเตอร์", theory: 0, practice: 2, credits: 1, periodsPerWeek: 2, blockSizes: [2], roomType: "computer", requiredEquipment: ["คอมพิวเตอร์"] },
    ],
    teachers: [
      { id: "t1", code: "T1", prefix: "นาย", firstName: "หนึ่ง", lastName: "ทดสอบ", position: "ครู", qualifiedCourseIds: ["c1"], unavailable: [], preferredOff: [], maxPerDay: 8, maxPerWeek: 30 },
      { id: "t2", code: "T2", prefix: "นาง", firstName: "สอง", lastName: "ทดสอบ", position: "ครู", qualifiedCourseIds: [], unavailable: [], preferredOff: [], maxPerDay: 8, maxPerWeek: 30 },
      { id: "t3", code: "T3", prefix: "นาย", firstName: "สาม", lastName: "ทดสอบ", position: "ครู", qualifiedCourseIds: [], unavailable: [], preferredOff: [], maxPerDay: 8, maxPerWeek: 30 },
    ],
    rooms: [
      { id: "r1", code: "R1", name: "บรรยาย 1", capacity: 40, type: "lecture", equipment: ["โปรเจกเตอร์"], unavailable: [] },
      { id: "r2", code: "R2", name: "คอม 2", capacity: 30, type: "computer", equipment: ["คอมพิวเตอร์"], unavailable: [] },
      { id: "r3", code: "R3", name: "บรรยาย 3", capacity: 40, type: "lecture", equipment: [], unavailable: [] },
      { id: "rx", code: "WP", name: "สถานประกอบการ", capacity: 999, type: "external", equipment: [], unavailable: [] },
    ],
    groups: [
      { id: "g1", code: "G1", name: "กลุ่ม 1", level: "ปวส.", size: 30 },
      { id: "g2", code: "G2", name: "กลุ่ม 2", level: "ปวส.", size: 20 },
      { id: "g3", code: "G3", name: "กลุ่ม 3", level: "ปวส.", size: 25 },
    ],
    students: [
      { id: "s1", code: "S1", displayName: "นักเรียน 1", groupId: "g1", extraAssignmentIds: [] },
      { id: "s2", code: "S2", displayName: "นักเรียน 2", groupId: "g2", extraAssignmentIds: [] },
    ],
    assignments: [
      { id: "a1", courseId: "c1", teacherId: "t1", groupIds: ["g1"] },
      { id: "a2", courseId: "c2", teacherId: "t2", groupIds: ["g2"] },
    ],
    activities: [],
  };
  const pl: Placement[] = [
    { assignmentId: "a1", block: 0, day: 0, period: 1, roomId: "r1" },
    { assignmentId: "a2", block: 0, day: 0, period: 1, roomId: "r2" },
  ];
  return { ds, pl };
}

export function hardTypes(r: ValidationResult): string[] {
  return r.violations.filter((v) => v.severity === "hard").map((v) => v.type);
}

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}
