import { createFixture, type FixtureKind } from "@/data/fixtures";
import { createMockDataset } from "@/data/mock";
import { createRayongDataset } from "@/data/rayong";
import { solve, DEFAULT_WEIGHTS } from "@/engine";
(async () => {
  const kinds = (process.argv[2] ?? "mock,rayong").split(",");
  const time = Number(process.argv[3] ?? 2000);
  for (const k of kinds) {
    for (const algorithm of ["heuristic", "ga", "tabu"] as const) {
      const ds = k === "mock" ? createMockDataset() : k === "rayong" ? createRayongDataset() : createFixture(k as FixtureKind, 1);
      const t = Date.now();
      const r = await solve(ds, { algorithm, seed: 1, timeLimitMs: time, weights: DEFAULT_WEIGHTS });
      const types: Record<string, number> = {};
      r.violations.filter(v => v.severity === "hard").forEach(v => types[v.type] = (types[v.type] ?? 0) + 1);
      console.log(`[${k}] ${algorithm.padEnd(9)} status=${r.status} hard=${r.score.hard} soft=${r.score.soft} it=${r.stats.iterations} elapsed=${Date.now() - t}ms`);
    }
  }
})();
