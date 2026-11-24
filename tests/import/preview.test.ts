import { describe, expect, it } from "vitest";
import { createMockDataset } from "@/data/mock";
import { autoMapColumns, parseImportFile } from "@/lib/import/parse";
import type { ParsedSheet } from "@/lib/import/parse";
import { buildImportPreview, itemsToCommit } from "@/lib/import/preview";
import type { ImportPreview } from "@/lib/import/preview";
import { IMPORT_SPECS } from "@/lib/import/specs";
import type { ImportKind } from "@/lib/import/specs";
import { ENTITY_SCHEMAS } from "@/shared/schemas";

const ds = createMockDataset();

/** สร้าง sheet จาก object ต่อแถว (คีย์ = key ของคอลัมน์) */
function sheetOf(kind: ImportKind, rows: Record<string, string>[], omit: string[] = []): ParsedSheet {
  const cols = IMPORT_SPECS[kind].columns.filter((c) => !omit.includes(c.key));
  return { headers: cols.map((c) => c.header), rows: rows.map((r) => cols.map((c) => r[c.key] ?? "")) };
}

function preview(kind: ImportKind, rows: Record<string, string>[], omit: string[] = []): ImportPreview {
  const sheet = sheetOf(kind, rows, omit);
  return buildImportPreview(kind, sheet, autoMapColumns(IMPORT_SPECS[kind], sheet.headers), ds);
}

function errorsAt(p: ImportPreview, rowNumber: number) {
  const r = p.rows.find((x) => x.rowNumber === rowNumber)!;
  return r.issues.filter((i) => i.level === "error");
}

function expectError(p: ImportPreview, rowNumber: number, field: string | undefined, re: RegExp) {
  const r = p.rows.find((x) => x.rowNumber === rowNumber)!;
  expect(r.action, `row ${rowNumber}`).toBe("error");
  expect(r.entity).toBeUndefined();
  const hit = r.issues.find((i) => i.level === "error" && (field === undefined || i.field === field) && re.test(i.message));
  expect(hit, `row ${rowNumber}: ${JSON.stringify(r.issues)}`).toBeTruthy();
}

const goodCourse = {
  code: "31999-0001",
  name: "วิชาทดสอบ",
  theory: "1",
  practice: "2",
  credits: "2",
  periodsPerWeek: "3",
  blockSizes: "1+2",
  roomType: "computer",
  requiredEquipment: "คอมพิวเตอร์; โปรเจกเตอร์",
  department: "IT",
  isActivity: "ไม่ใช่",
};

describe("buildImportPreview — courses", () => {
  const p = preview("courses", [
    goodCourse, // 2 create
    { ...goodCourse, code: "31901-2008", name: "ชื่อใหม่" }, // 3 update existing
    { ...goodCourse, code: "X-01", name: "" }, // 4 missing required
    { ...goodCourse, code: "X-02", theory: "abc" }, // 5 not a number
    { ...goodCourse, code: "X-03", credits: "2.5" }, // 6 not an integer
    { ...goodCourse, code: "31999-0001" }, // 7 duplicate in file
    { ...goodCourse, code: "X-04", blockSizes: "2+2" }, // 8 blockSizes sum mismatch
    { ...goodCourse, code: "X-05", roomType: "ห้องลับ" }, // 9 unknown room type
    { ...goodCourse, code: "X-06", isActivity: "อาจจะ" }, // 10 bad boolean
    { ...goodCourse, code: "X-07", name: "ก".repeat(121) }, // 11 Zod (max length)
    { ...goodCourse, code: "X-08", theory: "0", practice: "0", periodsPerWeek: "", blockSizes: "" }, // 12 Zod periodsPerWeek>0
    { ...goodCourse, code: "x-09", blockSizes: "" }, // 13 auto blocks (warning)
  ]);

  it("creates and updates good rows", () => {
    expect(p.rows[0].action).toBe("create");
    expect((p.rows[0].entity as { id: string }).id).toMatch(/^c-/);
    expect(p.rows[0].entity).toMatchObject({ code: "31999-0001", blockSizes: [1, 2], requiredEquipment: ["คอมพิวเตอร์", "โปรเจกเตอร์"], isActivity: false });
    expect(p.rows[1].action).toBe("update");
    expect((p.rows[1].entity as { id: string }).id).toBe("c-31901-2008");
    expect(p.rows[1].issues.some((i) => i.level === "warning" && /อยู่ในระบบแล้ว/.test(i.message))).toBe(true);
    expect(p.rows[11].action).toBe("create");
    expect(p.rows[11].entity).toMatchObject({ blockSizes: [1, 2] });
    expect(p.rows[11].issues.some((i) => i.level === "warning" && i.field === "blockSizes")).toBe(true);
  });

  it("detects bad rows with correct row numbers", () => {
    expectError(p, 4, "name", /ต้องระบุ/);
    expectError(p, 5, "theory", /ต้องเป็นตัวเลข/);
    expectError(p, 6, "credits", /จำนวนเต็ม/);
    expectError(p, 7, "code", /ซ้ำในไฟล์.*แถวที่ 2/);
    expectError(p, 8, "blockSizes", /ผลรวม/);
    expectError(p, 9, "roomType", /ไม่รู้จักประเภทห้อง/);
    expectError(p, 10, "isActivity", /ใช่\/ไม่ใช่/);
    expectError(p, 11, "name", /120/);
    expectError(p, 12, "periodsPerWeek", /มากกว่า 0/);
    // แถวแรกที่ซ้ำไม่ถือว่าผิด
    expect(errorsAt(p, 2)).toEqual([]);
  });

  it("summary counts", () => {
    expect(p.summary).toMatchObject({ total: 12, create: 2, update: 1, error: 9 });
    expect(p.summary.warning).toBeGreaterThanOrEqual(2);
  });

  it("itemsToCommit returns only valid entities that pass ENTITY_SCHEMAS", () => {
    const items = itemsToCommit(p);
    expect(items).toHaveLength(3);
    for (const it of items) expect(ENTITY_SCHEMAS.courses.safeParse(it).success).toBe(true);
  });

  it("missing required column → every row errors", () => {
    const q = preview("courses", [goodCourse], ["roomType"]);
    expectError(q, 2, "roomType", /ไม่พบคอลัมน์/);
  });

  it("update keeps existing values for columns not in file", () => {
    const q = preview("courses", [{ code: "31901-2008", name: "ชื่อแก้ไข" }], ["theory", "practice", "credits", "periodsPerWeek", "blockSizes", "roomType", "requiredEquipment", "department", "isActivity"]);
    expect(q.rows[0].action).toBe("update");
    const orig = ds.courses.find((c) => c.code === "31901-2008")!;
    expect(q.rows[0].entity).toEqual({ ...orig, name: "ชื่อแก้ไข" });
  });
});

describe("buildImportPreview — teachers", () => {
  const base = { code: "T900", prefix: "นาย", firstName: "ทดสอบ", lastName: "ระบบ", position: "ครูพิเศษ", maxPerDay: "6", maxPerWeek: "20" };
  const p = preview("teachers", [
    { ...base, qualifiedCourses: "31901-2008, 30000-1407", unavailable: "จ.1-2, ศ.13" }, // 2 ok
    { ...base, code: "T901", qualifiedCourses: "99999-9999" }, // 3 unknown ref
    { ...base, code: "T902", unavailable: "จ.14" }, // 4 slot out of range
    { ...base, code: "T903", maxPerDay: "25", maxPerWeek: "20" }, // 5 Zod max/refine
    { ...base, code: "T904", email: "not-an-email" }, // 6 Zod email
    { ...base, code: "T905", preferredOff: "ก.1" }, // 7 bad day
    { ...base, code: "t005" }, // 8 existing (case-insensitive) → update
  ]);
  it("good + update rows", () => {
    expect(p.rows[0].action).toBe("create");
    expect(p.rows[0].entity).toMatchObject({
      qualifiedCourseIds: ["c-31901-2008", "c-30000-1407"],
      unavailable: [
        { day: 0, period: 1 },
        { day: 0, period: 2 },
        { day: 4, period: 13 },
      ],
    });
    expect(p.rows[6].action).toBe("update");
    expect((p.rows[6].entity as { id: string }).id).toBe("t05");
  });
  it("bad rows", () => {
    expectError(p, 3, "qualifiedCourses", /ไม่พบรายวิชา/);
    expectError(p, 4, "unavailable", /เกินจำนวนคาบ/);
    expectError(p, 5, "maxPerDay", /./);
    expectError(p, 6, "email", /อีเมล/);
    expectError(p, 7, "preferredOff", /ไม่รู้จักวัน/);
  });
});

describe("buildImportPreview — other kinds", () => {
  it("assignments: unknown teacher / group, blockSizes mismatch, match existing", () => {
    const p = preview("assignments", [
      { courseCode: "31901-2008", teacherCode: "T005", groupCodes: "สIT.1/1" }, // 2 update a-002
      { courseCode: "31901-2008", teacherCode: "T999", groupCodes: "สIT.1/1" }, // 3 unknown teacher
      { courseCode: "31901-2008", teacherCode: "T005", groupCodes: "ไม่มี" }, // 4 unknown group
      { courseCode: "31901-2006", teacherCode: "T001", groupCodes: "ชIT.1/1", periodsPerWeek: "4", blockSizes: "2+1" }, // 5 sum mismatch
      { courseCode: "31901-2006", teacherCode: "T002", groupCodes: "ชIT.1/1; ชIT.2/1" }, // 6 create (multi group)
      { courseCode: "31901-2006", teacherCode: "T002", groupCodes: "ชIT.2/1, ชIT.1/1" }, // 7 duplicate in file (same set)
    ]);
    expect(p.rows[0].action).toBe("update");
    expect((p.rows[0].entity as { id: string }).id).toBe("a-002");
    expectError(p, 3, "teacherCode", /ไม่พบครู/);
    expectError(p, 4, "groupCodes", /ไม่พบกลุ่มเรียน/);
    expectError(p, 5, "blockSizes", /ผลรวม/);
    expect(p.rows[4].action).toBe("create");
    expect(p.rows[4].entity).toMatchObject({ groupIds: ["g-cit11", "g-cit21"], teacherId: "t02" });
    expectError(p, 7, undefined, /ซ้ำในไฟล์.*แถวที่ 6/);
    for (const it of itemsToCommit(p)) expect(ENTITY_SCHEMAS.assignments.safeParse(it).success).toBe(true);
  });

  it("students: assignment reference courseCode@groupCode", () => {
    const p = preview("students", [
      { code: "7000001", displayName: "ทดสอบ หนึ่ง", groupCode: "สIT.2/2", extraAssignments: "30000-1407@สIT.1/1" },
      { code: "7000002", displayName: "ทดสอบ สอง", groupCode: "สIT.2/2", extraAssignments: "30000-1407" },
      { code: "7000003", displayName: "ทดสอบ สาม", groupCode: "ไม่มีกลุ่ม" },
    ]);
    expect(p.rows[0].entity).toMatchObject({ groupId: "g-sit22", extraAssignmentIds: ["a-008"] });
    expectError(p, 3, "extraAssignments", /รหัสวิชา@รหัสกลุ่ม/);
    expectError(p, 4, "groupCode", /ไม่พบกลุ่มเรียน/);
  });

  it("activities: bad day, overflow periods, missing who (Zod refine), bool parsing", () => {
    const p = preview("activities", [
      { code: "ชุมนุม", name: "ชุมนุม", day: "ศ.", startPeriod: "8", length: "2", appliesToAll: "ใช่", countsAsLoad: "0" },
      { code: "ชุมนุม2", name: "ชุมนุม", day: "ศุกร์X", startPeriod: "8", length: "2", appliesToAll: "true" },
      { code: "ชุมนุม3", name: "ชุมนุม", day: "พ.", startPeriod: "12", length: "3", appliesToAll: "1" },
      { code: "ชุมนุม4", name: "ชุมนุม", day: "พ.", startPeriod: "1", length: "1", appliesToAll: "ไม่ใช่" },
      { code: "Home Room", name: "โฮมรูม", day: "พ.", startPeriod: "7", length: "1", teacherCodes: "T005", groupCodes: "สIT.1/1" },
    ]);
    expect(p.rows[0].entity).toMatchObject({ day: 4, appliesToAll: true, countsAsLoad: false });
    expectError(p, 3, "day", /ไม่รู้จักวัน/);
    expectError(p, 4, "length", /เกินจำนวนคาบ/);
    expectError(p, 5, "groupCodes", /ต้องระบุครูหรือกลุ่ม/);
    expect(p.rows[4].action).toBe("update");
    expect((p.rows[4].entity as { id: string }).id).toBe("act-hr-g-sit11");
  });

  it("rooms & groups: capacity must be > 0, advisor reference", () => {
    const r = preview("rooms", [{ code: "R1", name: "ห้อง", capacity: "0", type: "ห้องบรรยาย" }]);
    expectError(r, 2, "capacity", /มากกว่า 0/);
    const g = preview("groups", [{ code: "G1", name: "กลุ่ม", level: "ปวช.", size: "30", advisorTeacherCode: "T777" }]);
    expectError(g, 2, "advisorTeacherCode", /ไม่พบครู/);
  });

  it("row numbers follow the real sheet rows when blank rows are skipped", async () => {
    const csv = "﻿รหัสห้อง,ชื่อห้อง,ความจุ,ประเภทห้อง\r\nR1,ห้อง 1,30,lecture\r\n\r\n,,,\r\nR2,ห้อง 2,abc,lecture\r\n";
    const sheet = await parseImportFile(new TextEncoder().encode(csv).buffer as ArrayBuffer, "rooms.csv");
    const p = buildImportPreview("rooms", sheet, autoMapColumns(IMPORT_SPECS.rooms, sheet.headers), ds);
    expect(p.rows.map((r) => r.rowNumber)).toEqual([2, 5]);
    expectError(p, 5, "capacity", /ต้องเป็นตัวเลข/);
  });
});
