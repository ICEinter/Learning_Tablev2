import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, SOFT_KEYS, solve, validate, type ProgressEvent, type SolverOptions } from "@/engine";
import { createFixture, createFixtureWithSolution, type FixtureKind } from "@/data/fixtures";
import { createMockDataset } from "@/data/mock";

const opts = (o: Partial<SolverOptions>): SolverOptions => ({ algorithm: "heuristic", seed: 1, timeLimitMs: 5000, weights: DEFAULT_WEIGHTS, ...o });

describe("solve on mock dataset", () => {
  it("heuristic: feasible and consistent with validate()", async () => {
    const ds = createMockDataset();
    const r = await solve(ds, opts({ algorithm: "heuristic" }));
    const v = validate(ds, r.placements);
    expect(r.status).toBe("feasible");
    expect(v.score).toEqual(r.score);
    expect(r.score.hard).toBe(0);
    expect(r.explanation.length).toBeGreaterThan(0);
    expect(r.proofs).toEqual([]);
  });

  it("GA (maxIterations): feasible, consistent, not worse than heuristic", async () => {
    const ds = createMockDataset();
    const h = await solve(ds, opts({ algorithm: "heuristic", seed: 2 }));
    const g = await solve(ds, opts({ algorithm: "ga", seed: 2, maxIterations: 8, timeLimitMs: 60000 }));
    expect(g.status).toBe("feasible");
    expect(validate(ds, g.placements).score).toEqual(g.score);
    expect(g.score.soft).toBeLessThanOrEqual(h.score.soft);
    expect(g.stats.iterations).toBe(8);
    expect(g.stats.bestHistory.length).toBeGreaterThan(0);
    expect(g.stats.bestHistory.length).toBeLessThanOrEqual(200);
  });

  it("heuristic is deterministic for a seed", async () => {
    const ds = createMockDataset();
    const a = await solve(ds, opts({ seed: 9 }));
    const b = await solve(ds, opts({ seed: 9 }));
    expect(a.placements).toEqual(b.placements);
  });

  it("GA is deterministic for a seed with maxIterations", async () => {
    const ds = createFixture("normal", 1);
    const o = opts({ algorithm: "ga", seed: 4, maxIterations: 3, timeLimitMs: 60000, ga: { populationSize: 12 } });
    const a = await solve(ds, o);
    const b = await solve(ds, o);
    expect(a.placements).toEqual(b.placements);
    expect(a.score).toEqual(b.score);
  });

  it("Tabu search: feasible and consistent with validate()", async () => {
    const ds = createMockDataset();
    const r = await solve(ds, opts({ algorithm: "tabu", seed: 3, timeLimitMs: 5000 }));
    const v = validate(ds, r.placements);
    expect(r.status).toBe("feasible");
    expect(v.score).toEqual(r.score);
    expect(r.score.hard).toBe(0);
    expect(r.stats.algorithm).toBe("tabu");
  });

  it("reports throttled progress events", async () => {
    const events: ProgressEvent[] = [];
    await solve(createMockDataset(), opts({ algorithm: "ga", timeLimitMs: 800 }), { onProgress: (e) => events.push(e) });
    expect(events.length).toBeGreaterThan(1);
    expect(events[0].phase).toBe("precheck");
    expect(events.some((e) => e.phase === "ga")).toBe(true);
  });

  it("respects the time limit", async () => {
    const t = performance.now();
    const r = await solve(createFixture("normal", 1), opts({ algorithm: "ga", timeLimitMs: 700 }));
    const el = performance.now() - t;
    expect(el).toBeLessThan(700 + 400);
    expect(["feasible", "partial", "timeout"]).toContain(r.status);
  });
});

describe("cancellation", () => {
  it("returns best-so-far with status cancelled", async () => {
    const signal = { cancelled: false };
    setTimeout(() => (signal.cancelled = true), 300);
    const t = performance.now();
    const ds = createFixture("normal", 1);
    const r = await solve(ds, opts({ algorithm: "ga", timeLimitMs: 30000 }), { signal });
    expect(performance.now() - t).toBeLessThan(3000);
    expect(r.status).toBe("cancelled");
    expect(r.placements.length).toBeGreaterThan(0);
    expect(validate(ds, r.placements).score).toEqual(r.score);
  });

  it("agent can be cancelled too", async () => {
    const signal = { cancelled: false };
    setTimeout(() => (signal.cancelled = true), 300);
    const r = await solve(createFixture("normal", 1), opts({ algorithm: "agent", timeLimitMs: 30000 }), { signal });
    expect(r.status).toBe("cancelled");
  });
});

describe("agent workflow", () => {
  it("never modifies the dataset (hard constraints), logs rounds with Thai decisions", async () => {
    const ds = createMockDataset();
    const before = JSON.stringify(ds);
    const r = await solve(ds, opts({ algorithm: "agent", timeLimitMs: 2500, agent: { maxRounds: 4 } }));
    expect(JSON.stringify(ds)).toBe(before);
    expect(r.agentRounds!.length).toBeGreaterThanOrEqual(1);
    expect(r.agentRounds!.length).toBeLessThanOrEqual(4);
    for (const round of r.agentRounds!) {
      expect(round.decision).toMatch(/[ก-๙]/);
      expect(Object.keys(round.weights).sort()).toEqual([...SOFT_KEYS].sort());
      expect(Object.values(round.weights).every((w) => w >= 0)).toBe(true);
    }
    expect(r.status).toBe("feasible");
    // ผลถูกตัดสินด้วยน้ำหนักของผู้ใช้ ไม่ใช่น้ำหนักนำทาง
    expect(validate(ds, r.placements, DEFAULT_WEIGHTS).score).toEqual(r.score);
    expect(r.explanation.join("\n")).toMatch(/Agent ทำงาน/);
  });

  it("stops immediately with proof on infeasible data", async () => {
    const r = await solve(createFixture("infeasible-p3", 1), opts({ algorithm: "agent", timeLimitMs: 3000 }));
    expect(r.status).toBe("infeasible-proven");
    expect(r.agentRounds!.length).toBe(1);
    expect(r.agentRounds![0].decision).toMatch(/หลักฐาน/);
  });
});

describe("infeasible fixtures and hard-no-proof", () => {
  for (const k of ["p1", "p2", "p3", "p4", "p5", "p6", "p7"]) {
    it(`infeasible-${k} → infeasible-proven with proof ${k.toUpperCase()}`, async () => {
      const r = await solve(createFixture(`infeasible-${k}` as FixtureKind, 1), opts({ algorithm: "ga", timeLimitMs: 1000 }));
      expect(r.status).toBe("infeasible-proven");
      expect(r.proofs.some((p) => p.rule === k.toUpperCase())).toBe(true);
      expect(r.score.hard).toBeGreaterThan(0);
    });
  }

  it("hard-no-proof is never reported infeasible-proven", async () => {
    for (const algorithm of ["heuristic", "ga"] as const) {
      const r = await solve(createFixture("hard-no-proof", 1), opts({ algorithm, timeLimitMs: 1500 }));
      expect(r.status).not.toBe("infeasible-proven");
      expect(r.proofs).toEqual([]);
      expect(["timeout", "partial"]).toContain(r.status);
      expect(r.explanation.join("\n")).toMatch(/ไม่มีหลักฐาน/);
    }
  });
});

describe("planted fixtures are feasible by construction", () => {
  for (const k of ["normal", "edge", "stress"] as FixtureKind[]) {
    it(`${k}: planted solution validates with hard = 0 and labelled synthetic`, () => {
      const { dataset, solution } = createFixtureWithSolution(k, 1);
      expect(dataset.school.name).toMatch(/สังเคราะห์/);
      expect(validate(dataset, solution!).score.hard).toBe(0);
    });
  }

  it("edge: heuristic finds a feasible timetable", async () => {
    const ds = createFixture("edge", 1);
    const r = await solve(ds, opts({ algorithm: "heuristic", timeLimitMs: 10000 }));
    expect(r.status).toBe("feasible");
  });
});
