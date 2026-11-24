import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEFAULT_GA, DEFAULT_WEIGHTS, precheck, solve, validate } from "@/engine";
import { Ctl } from "@/engine/ctl";
import { runGA } from "@/engine/ga";
import { runHeuristic, inDomain } from "@/engine/heuristic";
import { buildModel } from "@/engine/model";
import { createRng } from "@/engine/rng";
import type { Dataset, Placement } from "@/shared/types";
import { createFixtureWithSolution } from "@/data/fixtures";
import { tiny } from "./helpers";

/** ปัญหาสุ่มขนาดเล็ก (อาจเป็นไปได้หรือไม่ก็ได้) */
const smallProblem = fc
  .record({
    days: fc.integer({ min: 1, max: 3 }),
    periods: fc.integer({ min: 3, max: 6 }),
    nAsg: fc.integer({ min: 1, max: 8 }),
    picks: fc.array(fc.record({ t: fc.integer({ min: 0, max: 2 }), g: fc.integer({ min: 0, max: 2 }), blocks: fc.array(fc.integer({ min: 1, max: 2 }), { minLength: 1, maxLength: 3 }) }), { minLength: 8, maxLength: 8 }),
    unavailable: fc.array(fc.record({ day: fc.integer({ min: 0, max: 2 }), period: fc.integer({ min: 1, max: 6 }) }), { maxLength: 4 }),
  })
  .map((p): Dataset => {
    const { ds } = tiny();
    ds.time.days.forEach((d) => (d.active = d.index < p.days));
    ds.time.periods = Array.from({ length: p.periods }, (_, i) => ({ no: i + 1, start: `${String(8 + i).padStart(2, "0")}:00`, end: `${String(9 + i).padStart(2, "0")}:00` }));
    ds.teachers.forEach((t) => (t.qualifiedCourseIds = []));
    ds.teachers[0].unavailable = p.unavailable;
    ds.assignments = p.picks.slice(0, p.nAsg).map((x, i) => ({
      id: `a${i}`,
      courseId: "c1",
      teacherId: `t${x.t + 1}`,
      groupIds: [`g${x.g + 1}`],
      blockSizes: x.blocks,
      periodsPerWeek: x.blocks.reduce((s, n) => s + n, 0),
    }));
    return ds;
  });

describe("property tests (fast-check)", () => {
  it("solve: feasible ⇒ validate hard 0; infeasible-proven ⇒ proofs; every block placed in grid", async () => {
    await fc.assert(
      fc.asyncProperty(smallProblem, fc.integer({ min: 1, max: 1000 }), async (ds, seed) => {
        const r = await solve(ds, { algorithm: "heuristic", seed, timeLimitMs: 2000, weights: DEFAULT_WEIGHTS });
        const v = validate(ds, r.placements);
        expect(v.score).toEqual(r.score);
        if (r.status === "feasible") expect(v.score.hard).toBe(0);
        if (r.status === "infeasible-proven") expect(r.proofs.length).toBeGreaterThan(0);
        if (r.proofs.length === 0) expect(r.status).not.toBe("infeasible-proven");
        const nBlocks = ds.assignments.reduce((s, a) => s + a.blockSizes!.length, 0);
        expect(r.placements.length).toBe(nBlocks);
        for (const p of r.placements) {
          expect(p.day).toBeGreaterThanOrEqual(0);
          expect(p.day).toBeLessThan(7);
          expect(p.period).toBeGreaterThanOrEqual(1);
        }
      }),
      { numRuns: 40 },
    );
  });

  it("problems built from a planted timetable are never declared infeasible", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10000 }), (seed) => {
        const { dataset, solution } = createFixtureWithSolution("normal", seed);
        expect(validate(dataset, solution!).score.hard).toBe(0);
        expect(precheck(dataset)).toEqual([]);
      }),
      { numRuns: 8 },
    );
  });

  it("small planted problems: solver never reports infeasible-proven", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 100000 }), async (seed) => {
        const ds = plantedTiny(seed);
        expect(precheck(ds)).toEqual([]);
        const r = await solve(ds, { algorithm: "heuristic", seed, timeLimitMs: 2000, weights: DEFAULT_WEIGHTS });
        expect(r.status).not.toBe("infeasible-proven");
      }),
      { numRuns: 30 },
    );
  });

  it("GA invariants: genes stay in domain/candidate rooms, best never worse than seeds", async () => {
    await fc.assert(
      fc.asyncProperty(smallProblem, fc.integer({ min: 1, max: 1000 }), async (ds, seed) => {
        const m = buildModel(ds);
        if (!m.blocks.length) return;
        const ctl = new Ctl(performance.now(), performance.now() + 10000);
        const h = await runHeuristic(m, DEFAULT_WEIGHTS, createRng(seed), ctl);
        const seedCost = h.state.fullCost();
        const res = await runGA(m, DEFAULT_WEIGHTS, { ...DEFAULT_GA, populationSize: 6 }, createRng(seed + 1), ctl, [
          { start: h.state.start.slice(), room: h.state.room.slice(), cost: seedCost, hard: h.state.lastHard, soft: h.state.lastSoft, hash: 0 },
        ], { maxGenerations: 3 });
        expect(res.best.cost).toBeLessThanOrEqual(seedCost + 1e-6);
        m.blocks.forEach((b) => {
          expect(inDomain(b.starts, res.best.start[b.id])).toBe(true);
          expect(Array.from(b.rooms)).toContain(res.best.room[b.id]);
        });
      }),
      { numRuns: 20 },
    );
  });
});

/** สร้างปัญหาจิ๋วจากตารางที่วางไว้ก่อน (ครู/กลุ่ม/ห้องไม่ชน) */
function plantedTiny(seed: number): Dataset {
  const rng = createRng(seed);
  const { ds } = tiny();
  ds.teachers.forEach((t) => (t.qualifiedCourseIds = []));
  ds.rooms = ds.rooms.filter((r) => r.type === "lecture");
  ds.rooms.forEach((r) => (r.capacity = 50));
  const usable: [number, number][] = [];
  for (let d = 0; d < 2; d++) for (const p of [1, 2, 4, 5]) usable.push([d, p]);
  const busy = new Set<string>();
  const plan: Placement[] = [];
  ds.assignments = [];
  for (let i = 0; i < 10; i++) {
    const t = `t${1 + rng.int(3)}`;
    const g = `g${1 + rng.int(3)}`;
    const [d, p] = usable[rng.int(usable.length)];
    const r = ds.rooms[rng.int(ds.rooms.length)].id;
    if (busy.has(`${t}@${d}:${p}`) || busy.has(`${g}@${d}:${p}`) || busy.has(`${r}@${d}:${p}`)) continue;
    [t, g, r].forEach((x) => busy.add(`${x}@${d}:${p}`));
    ds.assignments.push({ id: `a${i}`, courseId: "c1", teacherId: t, groupIds: [g] });
    plan.push({ assignmentId: `a${i}`, block: 0, day: d, period: p, roomId: r });
  }
  expect(validate(ds, plan).score.hard).toBe(0);
  return ds;
}
