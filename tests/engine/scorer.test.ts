import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, SOFT_KEYS, validate } from "@/engine";
import { buildModel } from "@/engine/model";
import { createRng } from "@/engine/rng";
import { State } from "@/engine/state";
import { createFixture } from "@/data/fixtures";
import { createMockDataset } from "@/data/mock";
import type { Dataset, Placement } from "@/shared/types";
import { tiny } from "./helpers";

function twoBlocks(): { ds: Dataset; pl: Placement[] } {
  const x = tiny();
  x.ds.assignments[0].blockSizes = [1, 1];
  x.ds.assignments[0].periodsPerWeek = 2;
  return x;
}

describe("soft scorer — hand-computed tiny cases", () => {
  it("clean tiny: only dayBalance from single-day loads", () => {
    const { ds, pl } = tiny();
    const b = validate(ds, pl).score.breakdown;
    // t1 [1,0] ไม่ลงตัว → 1−0−1 = 0; t2 [2,0] → 2; g1 → 0; g2 → 2
    expect(b).toEqual({ teacherGaps: 0, studentGaps: 0, dayBalance: 4, roomChanges: 0, preferredTimes: 0, sameCourseSameDay: 0, lateHours: 0 });
  });

  it("gaps skip break periods; same course same day; dayBalance", () => {
    const { ds, pl } = twoBlocks();
    pl[0] = { assignmentId: "a1", block: 0, day: 0, period: 1, roomId: "r1" };
    pl.push({ assignmentId: "a1", block: 1, day: 0, period: 4, roomId: "r1" });
    pl[1].day = 1;
    const r = validate(ds, pl);
    expect(r.score.hard).toBe(0);
    // คาบ 2 ว่าง (คาบ 3 เป็นพัก ไม่นับ) → ครู 1 กลุ่ม 1
    expect(r.score.breakdown.teacherGaps).toBe(1);
    expect(r.score.breakdown.studentGaps).toBe(1);
    expect(r.score.breakdown.sameCourseSameDay).toBe(1);
    // t1 [2,0] → 2, g1 [2,0] → 2, t2 [0,2] → 2, g2 → 2
    expect(r.score.breakdown.dayBalance).toBe(8);
    expect(r.score.breakdown.roomChanges).toBe(0);
  });

  it("room change between consecutive busy periods", () => {
    const { ds, pl } = twoBlocks();
    pl.push({ assignmentId: "a1", block: 1, day: 0, period: 2, roomId: "r3" });
    pl[1].day = 1;
    expect(validate(ds, pl).score.breakdown.roomChanges).toBe(1);
  });

  it("preferredTimes and lateHours; weighted soft sum", () => {
    const { ds, pl } = tiny();
    ds.teachers[0].preferredOff = [{ day: 0, period: 5 }];
    pl[0].period = 5; // 16:00–17:00 > 16:30
    const r = validate(ds, pl);
    expect(r.score.breakdown.preferredTimes).toBe(1);
    expect(r.score.breakdown.lateHours).toBe(1);
    // t1 วันจันทร์: คาบ 5 อย่างเดียว ไม่มีช่องว่าง; g1 เช่นกัน
    expect(r.score.breakdown.teacherGaps).toBe(0);
    const expected = SOFT_KEYS.reduce((s, k) => s + DEFAULT_WEIGHTS[k] * r.score.breakdown[k], 0);
    expect(r.score.soft).toBe(expected);
    const w = { ...DEFAULT_WEIGHTS, lateHours: 100 };
    expect(validate(ds, pl, w).score.soft).toBe(expected + 98);
  });

  it("locked activities count as busy for gaps", () => {
    const { ds, pl } = tiny();
    ds.activities.push({ id: "hr", code: "HR", name: "HR", day: 0, startPeriod: 4, length: 1, appliesToAll: false, teacherIds: ["t1"], groupIds: [], countsAsLoad: true });
    // t1: คาบ1 สอน, คาบ4 กิจกรรม → คาบ2 ว่าง = 1
    expect(validate(ds, pl).score.breakdown.teacherGaps).toBe(1);
  });
});

describe("incremental State matches the independent validator", () => {
  for (const [name, mk] of [
    ["mock", createMockDataset],
    ["normal", () => createFixture("normal", 2)],
    ["edge", () => createFixture("edge", 3)],
  ] as const) {
    it(`random placements on ${name}: soft breakdown equal, hard==0 ⇔ hard==0`, () => {
      const ds = mk();
      const m = buildModel(ds);
      const rng = createRng(11);
      const st = new State(m, DEFAULT_WEIGHTS);
      for (let trial = 0; trial < 6; trial++) {
        st.clear();
        for (const b of m.blocks) st.place(b.id, b.starts[rng.int(b.starts.length)], b.rooms[rng.int(b.rooms.length)]);
        // ย้ายสุ่มแบบ incremental แล้วตรวจว่า delta สะสม = fullCost ใหม่
        let cost = st.fullCost();
        for (let i = 0; i < 200; i++) {
          const b = m.blocks[rng.int(m.blocks.length)];
          cost += st.move(b.id, b.starts[rng.int(b.starts.length)], b.rooms[rng.int(b.rooms.length)]);
        }
        const full = st.fullCost();
        expect(Math.abs(full - cost)).toBeLessThan(1e-3);
        const v = validate(ds, st.toPlacements());
        expect(st.breakdown()).toEqual(v.score.breakdown);
        expect(st.lastSoft).toBeCloseTo(v.score.soft, 6);
        expect(st.lastHard === 0).toBe(v.score.hard === 0);
      }
    });
  }
});
