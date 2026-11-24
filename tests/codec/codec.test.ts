import { describe, expect, it } from "vitest";
import { decodePlacements, encodePlacements, packedSizeBytes } from "@/shared/codec";
import type { Placement } from "@/shared/types";

describe("packed timetable codec", () => {
  it("round-trip คืนค่าเดิมครบทุกฟิลด์และลำดับเดิม", () => {
    const placements: Placement[] = [
      { assignmentId: "a-001", block: 0, day: 0, period: 2, roomId: "r-it4" },
      { assignmentId: "a-001", block: 1, day: 3, period: 5, roomId: "r-it4" },
      { assignmentId: "a.weird;id", block: 0, day: 4, period: 10, roomId: "r-lab" },
    ];
    const packed = encodePlacements(placements);
    expect(packed.dict.a).toEqual(["a-001", "a.weird;id"]);
    expect(packed.dict.r).toEqual(["r-it4", "r-lab"]);
    expect(packed.entries).toBe("0.0.0.2.0;0.1.3.5.0;1.0.4.10.1;");
    expect(decodePlacements(packed)).toEqual(placements);
  });

  it("ตารางว่าง", () => {
    const packed = encodePlacements([]);
    expect(packed).toEqual({ dict: { a: [], r: [] }, entries: "" });
    expect(decodePlacements(packed)).toEqual([]);
  });

  it("ปฏิเสธข้อมูลเสียหาย", () => {
    expect(() => decodePlacements({ dict: { a: ["x"], r: ["y"] }, entries: "0.0.0;" })).toThrow();
    expect(() => decodePlacements({ dict: { a: ["x"], r: ["y"] }, entries: "5.0.0.1.0;" })).toThrow();
    expect(() => decodePlacements({ dict: { a: ["x"], r: ["y"] }, entries: "0.-1.0.1.0;" })).toThrow();
    expect(() => encodePlacements([{ assignmentId: "a", block: 0.5, day: 0, period: 1, roomId: "r" }])).toThrow();
  });

  it("ประเมินขนาดสำหรับ 1,800 entries (40 กลุ่ม × 45 คาบ)", () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 1800; i++) {
      placements.push({
        assignmentId: `a-${String(Math.floor(i / 3)).padStart(4, "0")}-lq3k9x4f2a`,
        block: i % 3,
        day: i % 5,
        period: 1 + (i % 10),
        roomId: `r-room-${String(i % 60).padStart(3, "0")}`,
      });
    }
    const packed = encodePlacements(placements);
    const bytes = packedSizeBytes(packed);
    const entriesBytes = packed.entries.length;
    console.log(
      `[codec] 1,800 entries: entries=${entriesBytes} B, dict a=${packed.dict.a.length} r=${packed.dict.r.length}, total≈${(bytes / 1024).toFixed(1)} KiB (เพดาน Firestore 1,024 KiB)`,
    );
    expect(decodePlacements(packed)).toEqual(placements);
    expect(bytes).toBeLessThan(100 * 1024);
  });
});
