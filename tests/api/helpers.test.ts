import { describe, expect, it, vi } from "vitest";
import { createMockDataset } from "@/data/mock";
import { buildViews } from "@/app/api/_lib/views";
import { claimsToSession } from "@/lib/auth/firebase-auth";
import { timetableFromDoc, timetableToDoc } from "@/shared/codec";
import type { TimetableVersion } from "@/shared/types";

describe("claimsToSession", () => {
  const user = { uid: "u1", displayName: "ครูทดสอบ", email: "t@example.com" };

  it("แปลง claims ที่ถูกต้องเป็น Session", () => {
    expect(claimsToSession(user, { role: "teacher", schoolId: "s1", teacherId: "t1" }, "s1")).toEqual({
      uid: "u1",
      role: "teacher",
      displayName: "ครูทดสอบ",
      teacherId: "t1",
      studentId: undefined,
      groupIds: undefined,
    });
  });

  it("ไม่มี role หรือ schoolId ไม่ตรง → null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(claimsToSession(user, { schoolId: "s1" }, "s1")).toBeNull();
    expect(claimsToSession(user, { role: "superuser", schoolId: "s1" }, "s1")).toBeNull();
    expect(claimsToSession(user, { role: "admin", schoolId: "other" }, "s1")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("timetable doc mapping", () => {
  it("round-trip ผ่าน TimetableDoc", () => {
    const tt: TimetableVersion = {
      id: "tt-1",
      termId: "term-1",
      label: "ร่าง 1",
      status: "draft",
      placements: [{ assignmentId: "a-1", block: 0, day: 1, period: 3, roomId: "r-1" }],
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      source: { algorithm: "heuristic", seed: 7 },
    };
    const d = timetableToDoc(tt, { hard: 0, soft: 12 }, { updatedAt: "2026-11-02T00:00:00.000Z", createdBy: "u1" });
    expect(d).toMatchObject({ entryCount: 1, hardViolations: 0, softScore: 12, createdBy: "u1" });
    expect(timetableFromDoc("tt-1", d)).toMatchObject({ ...tt, updatedAt: "2026-11-02T00:00:00.000Z" });
  });
});

describe("buildViews", () => {
  it("สร้าง view ของกลุ่ม/ครู/ห้องจาก placement", () => {
    const ds = createMockDataset();
    const a = ds.assignments[0];
    const room = ds.rooms[0];
    const views = buildViews(ds, [{ assignmentId: a.id, block: 0, day: 0, period: 2, roomId: room.id }], "v1");
    expect(views.get(`t_${a.teacherId}`)?.rows).toHaveLength(1);
    expect(views.get(`r_${room.id}`)?.kind).toBe("room");
    for (const g of a.groupIds) expect(views.get(`g_${g}`)?.versionId).toBe("v1");
    expect(views.size).toBe(2 + a.groupIds.length);
  });
});
