import { describe, expect, it } from "vitest";
import { evaluateMove, moveTargets, validate } from "@/engine";
import { createMockDataset } from "@/data/mock";
import { solve, DEFAULT_WEIGHTS } from "@/engine";
import { tiny } from "./helpers";

describe("moveTargets / evaluateMove", () => {
  it("lists every (day, period) with ok rooms or Thai reasons", () => {
    const { ds, pl } = tiny();
    const t = moveTargets(ds, pl, "a1", 0);
    expect(t.length).toBe(7 * 5);
    const at = (d: number, p: number) => t.find((x) => x.day === d && x.period === p)!;
    // ตำแหน่งเดิม (ไม่นับตัวเอง) ยังว่าง ห้องบรรยาย r1, r3 ใช้ได้; r2 (คอม) และ rx (external) ประเภทไม่ตรง
    expect(at(0, 1).okRoomIds.sort()).toEqual(["r1", "r3"]);
    expect(at(0, 3).okRoomIds).toEqual([]);
    expect(at(0, 3).reasons.join()).toMatch(/คาบพัก/);
    expect(at(5, 1).reasons.join()).toMatch(/ปิด/);
  });

  it("detects teacher/group/room conflicts and maxPerDay", () => {
    const { ds, pl } = tiny();
    ds.assignments.push({ id: "a3", courseId: "c1", teacherId: "t1", groupIds: ["g3"] });
    pl.push({ assignmentId: "a3", block: 0, day: 1, period: 2, roomId: "r3" });
    const t = moveTargets(ds, pl, "a1", 0);
    const at = (d: number, p: number) => t.find((x) => x.day === d && x.period === p)!;
    expect(at(1, 2).okRoomIds).toEqual([]);
    expect(at(1, 2).reasons.join()).toMatch(/มีสอน/);
    // ย้ายไปวันอังคารคาบ 1: ว่าง ทุกห้องบรรยายใช้ได้
    expect(at(1, 1).okRoomIds.sort()).toEqual(["r1", "r3"]);
    const r = evaluateMove(ds, pl, "a3", 0, { day: 0, period: 1, roomId: "r1" });
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/ห้อง R1/);
    expect(evaluateMove(ds, pl, "a3", 0, { day: 0, period: 2, roomId: "r1" })).toEqual({ ok: true, reasons: [] });
    ds.teachers[0].maxPerDay = 1;
    expect(evaluateMove(ds, pl, "a3", 0, { day: 0, period: 2, roomId: "r1" }).reasons.join()).toMatch(/เกิน 1 คาบ\/วัน/);
  });

  it("student clash from extra registrations is detected", () => {
    const { ds, pl } = tiny();
    ds.students[0].extraAssignmentIds = ["a2"];
    pl[1].day = 1;
    const r = evaluateMove(ds, pl, "a2", 0, { day: 0, period: 1, roomId: "r2" });
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/นักเรียน/);
  });

  it("applying any ok target to a feasible timetable keeps hard = 0 (mock)", async () => {
    const ds = createMockDataset();
    const res = await solve(ds, { algorithm: "heuristic", seed: 5, timeLimitMs: 5000, weights: DEFAULT_WEIGHTS });
    expect(res.score.hard).toBe(0);
    const p0 = res.placements[3];
    const targets = moveTargets(ds, res.placements, p0.assignmentId, p0.block).filter((x) => x.okRoomIds.length);
    expect(targets.length).toBeGreaterThan(0);
    for (const tg of targets.slice(0, 15)) {
      const moved = res.placements.map((p) => (p === p0 ? { ...p, day: tg.day, period: tg.period, roomId: tg.okRoomIds[0] } : p));
      expect(validate(ds, moved).score.hard).toBe(0);
      expect(evaluateMove(ds, res.placements, p0.assignmentId, p0.block, { day: tg.day, period: tg.period, roomId: tg.okRoomIds[0] }).ok).toBe(true);
    }
  });
});
