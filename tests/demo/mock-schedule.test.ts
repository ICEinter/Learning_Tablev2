import { describe, expect, it } from "vitest";
import { createMockDataset } from "@/data/mock";
import { DEFAULT_WEIGHTS, solve, validate } from "@/engine";
import { LocalRepository } from "@/lib/store/local-repository";

describe("demo timetable", () => {
  it("creates a valid timetable from the synthetic demo data", async () => {
    const dataset = createMockDataset();
    const result = await solve(dataset, {
      algorithm: "heuristic",
      seed: 1,
      timeLimitMs: 15_000,
      weights: DEFAULT_WEIGHTS,
    });

    expect(result.status).toBe("feasible");
    expect(result.placements.length).toBeGreaterThan(0);
    expect(validate(dataset, result.placements).score.hard).toBe(0);

    const repo = new LocalRepository();
    await repo.saveTimetable({
      id: "demo-smoke",
      termId: dataset.term.id,
      label: "Demo smoke test",
      status: "draft",
      placements: result.placements,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      source: { algorithm: "heuristic", seed: 1, jobId: "demo-smoke" },
      metrics: { hard: result.score.hard, soft: result.score.soft, elapsedMs: result.stats.elapsedMs },
      note: result.status,
    });
    const saved = await repo.load();
    expect(saved.timetables).toHaveLength(1);
    expect(saved.timetables[0].placements).toEqual(result.placements);
  }, 20_000);
});
