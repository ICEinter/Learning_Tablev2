import { describe, expect, it } from "vitest";
import { createMockDataset } from "@/data/mock";
import { buildGrid } from "@/lib/timetable/viewmodel";
import type { Placement } from "@/shared/types";

// ตารางทดสอบเล็ก ๆ วางด้วยมือ: ครู t05 สอน 31901-2008 กลุ่ม สIT.1/1 (a-002 blocks [1,2,2])
const placements: Placement[] = [
  { assignmentId: "a-002", block: 0, day: 1, period: 1, roomId: "r-it5" },
  { assignmentId: "a-002", block: 1, day: 1, period: 2, roomId: "r-it5" },
  { assignmentId: "a-002", block: 2, day: 1, period: 5, roomId: "r-it5" },
];

describe("buildGrid (ตารางครู)", () => {
  const ds = createMockDataset();
  const g = buildGrid(ds, placements, "teacher", "t05");

  it("มี 7 แถววัน และคอลัมน์คาบครบ 13", () => {
    expect(g.rows).toHaveLength(7);
    for (const r of g.rows) expect(r.cells.reduce((s, c) => s + c.span, 0)).toBe(13);
  });

  it("คาบต่อเนื่องรวมเซลล์ แต่ block ต่างกันไม่รวม", () => {
    const tue = g.rows[1].cells;
    expect(tue[0]).toMatchObject({ startPeriod: 1, span: 1, state: "lesson" });
    expect(tue[1]).toMatchObject({ startPeriod: 2, span: 2, state: "lesson" });
    expect(tue[1].items[0].lines).toEqual(["31901-2008", "IT5", "สIT.1/1 (17)"]);
  });

  it("กิจกรรม Home Room และ PLC แสดงแยกเป็น activity", () => {
    const wed = g.rows[2].cells;
    const hr = wed.find((c) => c.startPeriod === 7)!;
    const plc = wed.find((c) => c.startPeriod === 10)!;
    expect(hr.state).toBe("activity");
    expect(plc).toMatchObject({ state: "activity", span: 2 });
  });

  it("เสาร์/อาทิตย์เป็น inactive และช่องไม่ว่างของครูแสดง unavailable", () => {
    expect(g.rows[5].cells.every((c) => c.state === "inactive")).toBe(true);
    const thu = g.rows[3].cells;
    expect(thu.find((c) => c.startPeriod === 12)?.state).toBe("unavailable");
  });

  it("สรุปภาระ: ช. รวมกิจกรรม และแยกในเวลา/นอกเวลา", () => {
    const hr = g.summary.find((r) => r.code === "Home Room")!;
    const plc = g.summary.find((r) => r.code === "PLC")!;
    expect(hr).toMatchObject({ hours: 1, isActivity: true, theory: null });
    expect(plc.hours).toBe(2);
    expect(g.stats.teachingPeriods).toBe(5);
    expect(g.stats.activityPeriods).toBe(3);
    // PLC คาบ 10-11 จบหลัง 16:30 → นอกเวลา 2, ที่เหลือในเวลา
    expect(g.stats.outRegular).toBe(2);
    expect(g.stats.inRegular).toBe(6);
    // อังคาร: คาบ 1,2,3 แล้วว่างคาบ 4 ก่อนคาบ 5 → คาบว่างคั่น 1 / พุธ: คาบ 7 แล้วว่าง 8-9 ก่อน PLC 10 → 2
    expect(g.stats.freePeriods).toBe(3);
  });
});
