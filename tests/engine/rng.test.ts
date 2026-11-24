import { describe, expect, it } from "vitest";
import { createRng, forkSeed, mulberry32 } from "@/engine/rng";

describe("rng (mulberry32)", () => {
  it("golden values for seed 1", () => {
    const g = mulberry32(1);
    expect([g(), g(), g()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });

  it("golden int/fork for seed 42", () => {
    const r = createRng(42);
    expect([r.int(100), r.int(100), r.int(100)]).toEqual([60, 44, 85]);
    expect(r.fork("a").int(1000)).toBe(178);
  });

  it("same seed ⇒ same sequence; different seed ⇒ different", () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const sa = Array.from({ length: 50 }, () => a.next());
    const sb = Array.from({ length: 50 }, () => b.next());
    const sc = Array.from({ length: 50 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("shuffle is a deterministic permutation; fork is label-dependent", () => {
    const x = createRng(3).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    const y = createRng(3).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(x).toEqual(y);
    expect([...x].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(forkSeed(1, "a")).not.toBe(forkSeed(1, "b"));
    expect(forkSeed(1, "a")).toBe(forkSeed(1, "a"));
  });
});
