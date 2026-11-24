import { describe, expect, it } from "vitest";
import {
  conflictReport,
  freePeriodsReport,
  placementListReport,
  roomUtilizationReport,
  teacherLoadReport,
} from "@/lib/reports/reports";
import type { Dataset, Placement } from "@/shared/types";

/**
 * ชุดข้อมูลเล็กที่คำนวณด้วยมือได้
 * วัน: จ., อ. เปิด / พ. ปิด ; คาบ 1–5 (คาบ 3 = พัก) ; ในเวลา ≤ 11:30
 */
function tiny(): Dataset {
  return {
    school: { id: "s", name: "โรงเรียนทดสอบ", signatories: [], regularEndTime: "11:30" },
    term: { id: "t", year: "2569", term: "1", status: "active" },
    time: {
      days: [
        { index: 0, label: "วันจันทร์", short: "จ.", active: true },
        { index: 1, label: "วันอังคาร", short: "อ.", active: true },
        { index: 2, label: "วันพุธ", short: "พ.", active: false },
      ],
      periods: [
        { no: 1, start: "08:00", end: "09:00" },
        { no: 2, start: "09:00", end: "10:00" },
        { no: 3, start: "10:00", end: "10:30", isBreak: true, label: "พัก" },
        { no: 4, start: "10:30", end: "11:30" },
        { no: 5, start: "11:30", end: "12:30" },
      ],
    },
    courses: [
      { id: "C1", code: "C001", name: "วิชาหนึ่ง", theory: 1, practice: 2, credits: 2, periodsPerWeek: 3, blockSizes: [2, 1], roomType: "lecture", requiredEquipment: [] },
      { id: "C2", code: "C002", name: "วิชาสอง", theory: 0, practice: 2, credits: 1, periodsPerWeek: 2, blockSizes: [2], roomType: "lecture", requiredEquipment: [] },
    ],
    teachers: [
      { id: "T1", code: "T01", prefix: "นาย", firstName: "หนึ่ง", lastName: "ทดสอบ", position: "ครู", qualifiedCourseIds: [], unavailable: [], preferredOff: [], maxPerDay: 3, maxPerWeek: 4 },
      { id: "T2", code: "T02", prefix: "นาง", firstName: "สอง", lastName: "ทดสอบ", position: "ครู", department: "แผนก", qualifiedCourseIds: [], unavailable: [{ day: 1, period: 5 }], preferredOff: [], maxPerDay: 4, maxPerWeek: 10 },
    ],
    rooms: [
      { id: "R1", code: "R01", name: "ห้องหนึ่ง", capacity: 40, type: "lecture", equipment: [], unavailable: [{ day: 0, period: 1 }] },
      { id: "R2", code: "R02", name: "ห้องสอง", capacity: 40, type: "lecture", equipment: [], unavailable: [] },
    ],
    groups: [
      { id: "G1", code: "G01", name: "กลุ่มหนึ่ง", level: "ปวช.", size: 30 },
      { id: "G2", code: "G02", name: "กลุ่มสอง", level: "ปวช.", size: 30 },
    ],
    students: [],
    assignments: [
      { id: "A1", courseId: "C1", teacherId: "T1", groupIds: ["G1"] },
      { id: "A2", courseId: "C2", teacherId: "T2", groupIds: ["G2"] },
      { id: "A3", courseId: "C2", teacherId: "T1", groupIds: ["G2"] },
    ],
    activities: [
      { id: "HR", code: "HR", name: "โฮมรูม", day: 1, startPeriod: 4, length: 1, appliesToAll: false, teacherIds: ["T1"], groupIds: ["G1"], roomId: "R2", countsAsLoad: true },
    ],
  };
}

const placements: Placement[] = [
  { assignmentId: "A2", block: 0, day: 1, period: 1, roomId: "R2" },
  { assignmentId: "A1", block: 1, day: 0, period: 5, roomId: "R1" },
  { assignmentId: "A1", block: 0, day: 0, period: 1, roomId: "R1" },
];

describe("teacherLoadReport", () => {
  const rep = teacherLoadReport(tiny(), placements);
  it("computes per-teacher numbers", () => {
    expect(rep.rows).toEqual([
      {
        code: "T01",
        name: "นายหนึ่ง ทดสอบ",
        position: "ครู",
        department: "-",
        assigned: 5, // A1 3 + A3 2
        scheduled: 3, // จ.1-2 + จ.5
        activity: 1, // HR
        total: 4,
        maxPerWeek: 4,
        maxDay: 3, // จันทร์ 3 คาบ
        inRegular: 3, // จ.1, จ.2, อ.4 (สิ้นสุด 11:30)
        outRegular: 1, // จ.5 (สิ้นสุด 12:30)
        gaps: 1, // จ.4 (คาบ 3 เป็นพัก ไม่นับ)
        status: "ยังจัดไม่ครบ",
      },
      {
        code: "T02",
        name: "นางสอง ทดสอบ",
        position: "ครู",
        department: "แผนก",
        assigned: 2,
        scheduled: 2,
        activity: 0,
        total: 2,
        maxPerWeek: 10,
        maxDay: 2,
        inRegular: 2,
        outRegular: 0,
        gaps: 0,
        status: "ปกติ",
      },
    ]);
    expect(rep.columns.map((c) => c.key)).toContain("status");
  });

  it("flags overload", () => {
    const ds = tiny();
    ds.teachers[0].maxPerWeek = 3;
    expect(teacherLoadReport(ds, placements).rows[0].status).toBe("เกิน");
  });
});

describe("freePeriodsReport", () => {
  it("gaps per active day, totals and free teachable slots", () => {
    const rep = freePeriodsReport(tiny(), placements);
    expect(rep.columns.map((c) => c.key)).toEqual(["type", "code", "name", "d0", "d1", "totalGaps", "freeSlots"]);
    expect(rep.rows).toEqual([
      { type: "ครู", code: "T01", name: "นายหนึ่ง ทดสอบ", d0: 1, d1: 0, totalGaps: 1, freeSlots: 4 }, // 8 − {จ1,จ2,จ5,อ4}
      { type: "ครู", code: "T02", name: "นางสอง ทดสอบ", d0: 0, d1: 0, totalGaps: 0, freeSlots: 5 }, // 8 − {อ1,อ2} − ไม่ว่าง อ5
      { type: "กลุ่มเรียน", code: "G01", name: "กลุ่มหนึ่ง", d0: 1, d1: 0, totalGaps: 1, freeSlots: 4 },
      { type: "กลุ่มเรียน", code: "G02", name: "กลุ่มสอง", d0: 0, d1: 0, totalGaps: 0, freeSlots: 6 },
    ]);
  });
});

describe("roomUtilizationReport", () => {
  it("used / available / % / busiest day", () => {
    const rep = roomUtilizationReport(tiny(), placements);
    expect(rep.rows).toEqual([
      // ใช้ จ1 จ2 จ5 = 3 ; ใช้ได้ 8 − 1 (จ1 ไม่พร้อม) = 7 ; ใช้ในช่วงที่ใช้ได้ 2 → 28.6%
      { code: "R01", name: "ห้องหนึ่ง", type: "ห้องบรรยาย", capacity: 40, used: 3, available: 7, utilization: 28.6, busiestDay: "วันจันทร์ (3)" },
      // อ1 อ2 + HR อ4 = 3 / 8 = 37.5%
      { code: "R02", name: "ห้องสอง", type: "ห้องบรรยาย", capacity: 40, used: 3, available: 8, utilization: 37.5, busiestDay: "วันอังคาร (3)" },
    ]);
  });
});

describe("placementListReport", () => {
  it("sorted by day/period with time ranges", () => {
    const rep = placementListReport(tiny(), placements);
    expect(rep.title).toBe("ตารางรวม");
    expect(rep.rows).toEqual([
      { day: "วันจันทร์", periods: "1-2", time: "08:00 - 10:00", courseCode: "C001", courseName: "วิชาหนึ่ง", groups: "G01", teacher: "นายหนึ่ง ทดสอบ", room: "R01" },
      { day: "วันจันทร์", periods: "5", time: "11:30 - 12:30", courseCode: "C001", courseName: "วิชาหนึ่ง", groups: "G01", teacher: "นายหนึ่ง ทดสอบ", room: "R01" },
      { day: "วันอังคาร", periods: "1-2", time: "08:00 - 10:00", courseCode: "C002", courseName: "วิชาสอง", groups: "G02", teacher: "นางสอง ทดสอบ", room: "R02" },
    ]);
  });
});

describe("conflictReport", () => {
  it("hard first, labels entities and formats slots", () => {
    const rep = conflictReport(tiny(), [
      { type: "teacher-gap", severity: "soft", message: "คาบว่างคั่น", entities: [{ kind: "teacher", id: "T1" }], slots: [{ day: 0, period: 4 }] },
      {
        type: "room-clash",
        severity: "hard",
        message: "ห้องชน",
        entities: [
          { kind: "rooms", id: "R1" },
          { kind: "assignment", id: "A1" },
          { kind: "group", id: "G2" },
        ],
        slots: [
          { day: 0, period: 2 },
          { day: 0, period: 1 },
        ],
      },
    ]);
    expect(rep.rows).toEqual([
      { no: 1, severity: "ต้องแก้ (Hard)", type: "room-clash", message: "ห้องชน", entities: "ห้อง R01, C001@G01, กลุ่ม G02", slots: "จ.1-2" },
      { no: 2, severity: "ควรปรับ (Soft)", type: "teacher-gap", message: "คาบว่างคั่น", entities: "ครู นายหนึ่ง ทดสอบ", slots: "จ.4" },
    ]);
    expect(rep.subtitle).toMatch(/Hard 1 รายการ, Soft 1 รายการ/);
    expect(conflictReport(tiny(), []).footnote).toBe("ไม่พบข้อขัดแย้ง");
  });
});
