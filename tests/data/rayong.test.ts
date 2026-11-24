import { describe, expect, it } from "vitest";
import { createRayongDataset } from "@/data/rayong";
import { checkDataset } from "@/shared/integrity";
import { precheck, solve, validate } from "@/engine";

describe("Rayong Technical College dataset (real data)", () => {
  it("passes all integrity checks without error", () => {
    const ds = createRayongDataset();
    const issues = checkDataset(ds);
    const errors = issues.filter((x) => x.level === "error");
    expect(errors).toEqual([]);
    expect(ds.teachers.length).toBe(10);
    expect(ds.groups.length).toBe(10);
    expect(ds.assignments.length).toBeGreaterThan(30);
  });

  it("passes precheck with no mathematical infeasibility proofs", () => {
    const ds = createRayongDataset();
    const proofs = precheck(ds);
    expect(proofs).toEqual([]);
  });

  it("can be solved by Heuristic and Tabu Search with hard = 0", async () => {
    const ds = createRayongDataset();
    const tabuRes = await solve(ds, {
      algorithm: "tabu",
      seed: 42,
      timeLimitMs: 8000,
      weights: {
        teacherGaps: 3,
        studentGaps: 3,
        dayBalance: 2,
        roomChanges: 1,
        preferredTimes: 4,
        sameCourseSameDay: 2,
        lateHours: 2,
      },
    });
    expect(tabuRes.status).toBe("feasible");
    expect(tabuRes.score.hard).toBe(0);
    const v = validate(ds, tabuRes.placements);
    expect(v.score.hard).toBe(0);

    const gaRes = await solve(ds, {
      algorithm: "ga",
      seed: 42,
      timeLimitMs: 8000,
      weights: {
        teacherGaps: 3,
        studentGaps: 3,
        dayBalance: 2,
        roomChanges: 1,
        preferredTimes: 4,
        sameCourseSameDay: 2,
        lateHours: 2,
      },
    });
    expect(gaRes.status).toBe("feasible");
    expect(gaRes.score.hard).toBe(0);
    expect(validate(ds, gaRes.placements).score.hard).toBe(0);
  }, 15000);
});
