import { describe, expect, it } from "vitest";
import { createMockDataset } from "@/data/mock";
import { checkDataset } from "@/shared/integrity";
import { DatasetSchema } from "@/shared/schemas";
import { slotIndex, slotRef, effectiveBlocks } from "@/shared/slots";

describe("mock dataset", () => {
  it("ผ่าน Zod schema ทั้งชุด", () => {
    const r = DatasetSchema.safeParse(createMockDataset());
    expect(r.success, JSON.stringify(r.success ? [] : r.error.issues.slice(0, 3))).toBe(true);
  });

  it("ไม่มีข้อผิดพลาดเชิงอ้างอิง", () => {
    const errors = checkDataset(createMockDataset()).filter((i) => i.level === "error");
    expect(errors).toEqual([]);
  });
});

describe("checkDataset ตรวจพบข้อมูลผิด", () => {
  it("รหัสซ้ำ / อ้างอิงไม่พบ / ครูไม่มีคุณสมบัติ / ไม่มีห้องที่ตรงเงื่อนไข", () => {
    const ds = createMockDataset();
    ds.courses.push({ ...ds.courses[0], id: "c-dup" }); // รหัสซ้ำ
    ds.assignments.push({ id: "a-bad", courseId: "c-none", teacherId: "t01", groupIds: ["g-none"] });
    ds.assignments.push({ id: "a-unq", courseId: "c-30000-1221", teacherId: "t01", groupIds: ["g-sit11"] });
    ds.courses.find((c) => c.code === "31906-2014")!.requiredEquipment = ["เครื่องพิมพ์สามมิติ"];
    const msgs = checkDataset(ds).filter((i) => i.level === "error").map((i) => i.message);
    expect(msgs.some((m) => m.includes("ซ้ำ"))).toBe(true);
    expect(msgs.some((m) => m.includes("ไม่พบรายวิชา"))).toBe(true);
    expect(msgs.some((m) => m.includes("ไม่พบกลุ่มเรียน"))).toBe(true);
    expect(msgs.some((m) => m.includes("ไม่มีคุณสมบัติ"))).toBe(true);
    expect(msgs.some((m) => m.includes("ไม่มีห้องที่ตรงเงื่อนไข"))).toBe(true);
  });

  it("blockSizes ไม่เท่ากับ periodsPerWeek ถูกปฏิเสธ", () => {
    const ds = createMockDataset();
    ds.courses[1].blockSizes = [1, 1];
    expect(checkDataset(ds).some((i) => i.field === "blockSizes")).toBe(true);
  });

  it("คาบทับซ้อนในโครงสร้างเวลา", () => {
    const ds = createMockDataset();
    ds.time.periods[1].start = "09:00";
    expect(checkDataset(ds).some((i) => i.entity === "time")).toBe(true);
  });
});

describe("slot helpers", () => {
  it("slotIndex/slotRef กลับค่ากันได้", () => {
    const ds = createMockDataset();
    for (const ref of [{ day: 0, period: 1 }, { day: 4, period: 13 }, { day: 2, period: 7 }]) {
      expect(slotRef(ds.time, slotIndex(ds.time, ref))).toEqual(ref);
    }
  });
  it("effectiveBlocks ใช้ค่าจากรายวิชาหรือ override", () => {
    const ds = createMockDataset();
    const c = ds.courses.find((x) => x.code === "31901-2008")!;
    expect(effectiveBlocks({ id: "a", courseId: c.id, teacherId: "t", groupIds: [] }, c)).toEqual([1, 2, 2]);
    expect(effectiveBlocks({ id: "a", courseId: c.id, teacherId: "t", groupIds: [], periodsPerWeek: 3 }, c)).toEqual([2, 1]);
  });
});
