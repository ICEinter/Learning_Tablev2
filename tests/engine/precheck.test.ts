import { describe, expect, it } from "vitest";
import { precheck } from "@/engine";
import { createFixture, type FixtureKind } from "@/data/fixtures";
import { createMockDataset } from "@/data/mock";
import { tiny } from "./helpers";

const rules = (ds: Parameters<typeof precheck>[0]) => [...new Set(precheck(ds).map((p) => p.rule))].sort();

describe("precheck — fixtures", () => {
  it("feasible datasets produce no proof", () => {
    expect(precheck(createMockDataset())).toEqual([]);
    for (const k of ["normal", "edge", "hard-no-proof"] as FixtureKind[]) expect(precheck(createFixture(k, 1))).toEqual([]);
  });

  for (const r of ["P1", "P2", "P3", "P4", "P5", "P6", "P7"]) {
    it(`infeasible-${r.toLowerCase()} triggers ${r} with numbers and Thai message`, () => {
      const proofs = precheck(createFixture(`infeasible-${r.toLowerCase()}` as FixtureKind, 1));
      const p = proofs.find((x) => x.rule === r);
      expect(p).toBeDefined();
      expect(p!.required).toBeGreaterThan(p!.available);
      expect(p!.message.length).toBeGreaterThan(10);
      expect(p!.entities.length).toBeGreaterThan(0);
    });
  }
});

describe("precheck — trigger vs near-miss on tiny data (8 usable slots)", () => {
  it("P1 maxPerWeek", () => {
    const a = tiny().ds;
    a.teachers[1].maxPerWeek = 2;
    expect(rules(a)).toEqual([]);
    a.teachers[1].maxPerWeek = 1;
    expect(rules(a)).toEqual(["P1"]);
  });

  it("P1 free slots / maxPerDay", () => {
    const a = tiny().ds;
    a.assignments[1].blockSizes = [2, 2, 2, 2]; // 8 คาบ = 8 slot
    a.assignments[1].periodsPerWeek = 8;
    a.groups[1].size = 20;
    expect(rules(a)).toEqual([]);
    a.teachers[1].maxPerDay = 3; // สอนได้ 3+3 = 6 < 8
    expect(rules(a)).toEqual(["P1"]);
  });

  it("P2 group availability", () => {
    const a = tiny().ds;
    const lock = (day: number, p: number, i: number) =>
      a.activities.push({ id: `x${i}`, code: "X", name: "X", day, startPeriod: p, length: 1, appliesToAll: false, teacherIds: [], groupIds: ["g2"], countsAsLoad: false });
    // เหลือ จ. คาบ 1–2 ว่าง = 2 slot = ต้องการ 2
    [[0, 4], [0, 5], [1, 1], [1, 2], [1, 4], [1, 5]].forEach(([d, p], i) => lock(d, p, i));
    expect(rules(a)).toEqual([]);
    lock(0, 2, 99);
    expect(rules(a)).toContain("P2");
  });

  it("P3 no matching room", () => {
    const a = tiny().ds;
    a.courses[1].requiredEquipment = ["คอมพิวเตอร์", "GPU"];
    expect(rules(a)).toEqual(["P3"]);
    a.rooms[1].equipment.push("GPU");
    expect(rules(a)).toEqual([]);
  });

  it("P4 block longer than any break-free run", () => {
    const a = tiny().ds;
    a.assignments[1].blockSizes = [3];
    a.assignments[1].periodsPerWeek = 3;
    expect(rules(a)).toEqual(["P4"]);
    a.assignments[1].blockSizes = [2];
    a.assignments[1].periodsPerWeek = 2;
    expect(rules(a)).toEqual([]);
  });

  it("P5 unqualified assignment", () => {
    const a = tiny().ds;
    a.teachers[0].qualifiedCourseIds = ["c2"];
    expect(rules(a)).toEqual(["P5"]);
    a.teachers[0].qualifiedCourseIds = ["c1", "c2"];
    expect(rules(a)).toEqual([]);
  });

  it("P6 room-type pigeonhole", () => {
    const a = tiny().ds;
    a.assignments[1].blockSizes = [2, 2];
    a.assignments[1].periodsPerWeek = 4;
    a.assignments.push({ id: "a3", courseId: "c2", teacherId: "t3", groupIds: ["g3"], blockSizes: [2, 2], periodsPerWeek: 4 });
    expect(rules(a)).toEqual([]); // ห้องคอม 1 ห้อง 8 slot = ต้องการ 8
    a.assignments[2].blockSizes = [2, 2, 1];
    a.assignments[2].periodsPerWeek = 5;
    expect(rules(a)).toEqual(["P6"]);
  });

  it("P7 conflict triangle", () => {
    const a = tiny().ds;
    a.rooms[0].capacity = 60;
    a.assignments = [
      { id: "x", courseId: "c1", teacherId: "t1", groupIds: ["g1"], blockSizes: [1, 1, 1], periodsPerWeek: 3 },
      { id: "y", courseId: "c1", teacherId: "t1", groupIds: ["g2"], blockSizes: [1, 1, 1], periodsPerWeek: 3 },
      { id: "z", courseId: "c1", teacherId: "t3", groupIds: ["g1", "g2"], blockSizes: [1, 1], periodsPerWeek: 2 },
    ];
    expect(rules(a)).toEqual([]); // 3+3+2 = 8
    a.assignments[2].blockSizes = [1, 1, 1];
    a.assignments[2].periodsPerWeek = 3;
    const proofs = precheck(a);
    expect(proofs.map((p) => p.rule)).toEqual(["P7"]);
    expect(proofs[0].required).toBe(9);
    expect(proofs[0].available).toBe(8);
  });

  it("precheck on stress dataset is fast (bounded P7)", () => {
    const ds = createFixture("stress", 1);
    const t = performance.now();
    expect(precheck(ds)).toEqual([]);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
