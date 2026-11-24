import { describe, expect, it } from "vitest";
import { validate } from "@/engine";
import { clone, hardTypes, tiny } from "./helpers";

describe("validator — clean baseline", () => {
  it("tiny clean timetable has no hard violations", () => {
    const { ds, pl } = tiny();
    const r = validate(ds, pl);
    expect(hardTypes(r)).toEqual([]);
    expect(r.score.hard).toBe(0);
  });
});

/** แต่ละกรณี: แก้ตารางสะอาดให้เกิดการละเมิดเพียงชนิดเดียว และมีคู่แฝดที่สะอาด */
type Case = { name: string; type: string; count?: number; bad: (x: ReturnType<typeof tiny>) => void; good?: (x: ReturnType<typeof tiny>) => void };

const cases: Case[] = [
  {
    name: "teacher teaches two classes at once",
    type: "TEACHER_CLASH",
    bad: ({ ds }) => {
      ds.teachers[0].qualifiedCourseIds = [];
      ds.assignments[1].teacherId = "t1";
    },
    good: ({ ds, pl }) => {
      ds.teachers[0].qualifiedCourseIds = [];
      ds.assignments[1].teacherId = "t1";
      pl[1].day = 1;
    },
  },
  {
    name: "room used twice (2 slots)",
    type: "ROOM_CLASH",
    count: 2,
    bad: ({ ds, pl }) => {
      ds.assignments.push({ id: "a3", courseId: "c2", teacherId: "t3", groupIds: ["g3"] });
      pl.push({ assignmentId: "a3", block: 0, day: 0, period: 1, roomId: "r2" });
    },
    good: ({ ds, pl }) => {
      ds.assignments.push({ id: "a3", courseId: "c2", teacherId: "t3", groupIds: ["g3"] });
      pl.push({ assignmentId: "a3", block: 0, day: 1, period: 1, roomId: "r2" });
    },
  },
  {
    name: "external room is non-exclusive",
    type: "NONE",
    bad: ({ ds, pl }) => {
      ds.assignments.push({ id: "a3", courseId: "c2", teacherId: "t3", groupIds: ["g3"], fixedRoomId: "rx" });
      ds.assignments.push({ id: "a4", courseId: "c1", teacherId: "t2", groupIds: ["g1"], fixedRoomId: "rx" });
      pl.push({ assignmentId: "a3", block: 0, day: 1, period: 1, roomId: "rx" });
      pl.push({ assignmentId: "a4", block: 0, day: 1, period: 1, roomId: "rx" });
    },
  },
  {
    name: "group has two classes at once",
    type: "GROUP_CLASH",
    bad: ({ ds, pl }) => {
      ds.assignments.push({ id: "a3", courseId: "c1", teacherId: "t3", groupIds: ["g1"] });
      pl.push({ assignmentId: "a3", block: 0, day: 0, period: 1, roomId: "r3" });
    },
    good: ({ ds, pl }) => {
      ds.assignments.push({ id: "a3", courseId: "c1", teacherId: "t3", groupIds: ["g1"] });
      pl.push({ assignmentId: "a3", block: 0, day: 0, period: 2, roomId: "r3" });
    },
  },
  {
    name: "cross-group student clash",
    type: "STUDENT_CLASH",
    bad: ({ ds }) => {
      ds.students[0].extraAssignmentIds = ["a2"];
    },
    good: ({ ds, pl }) => {
      ds.students[0].extraAssignmentIds = ["a2"];
      pl[1].day = 1;
    },
  },
  {
    name: "missing placement",
    type: "PERIOD_COUNT",
    bad: ({ pl }) => {
      pl.splice(0, 1);
    },
  },
  {
    name: "duplicate placement",
    type: "PERIOD_COUNT",
    bad: ({ pl }) => {
      pl.push({ assignmentId: "a1", block: 0, day: 1, period: 1, roomId: "r1" });
    },
  },
  { name: "block crosses end of day", type: "BLOCK_SPLIT", bad: ({ pl }) => (pl[1].period = 5) },
  { name: "out of grid", type: "OUT_OF_GRID", bad: ({ pl }) => (pl[0].day = 9) },
  { name: "on break", type: "BREAK", bad: ({ pl }) => (pl[0].period = 3) },
  { name: "inactive day", type: "INACTIVE_DAY", bad: ({ pl }) => (pl[0].day = 5) },
  { name: "unqualified teacher", type: "UNQUALIFIED", bad: ({ ds }) => (ds.teachers[0].qualifiedCourseIds = ["c2"]) },
  { name: "room too small", type: "ROOM_CAPACITY", bad: ({ ds }) => (ds.rooms[0].capacity = 10) },
  { name: "wrong room type", type: "ROOM_TYPE", bad: ({ pl }) => (pl[0].roomId = "rx") },
  {
    name: "fixed room not used",
    type: "ROOM_TYPE",
    bad: ({ ds }) => (ds.assignments[0].fixedRoomId = "r3"),
    good: ({ ds, pl }) => {
      ds.assignments[0].fixedRoomId = "rx";
      pl[0].roomId = "rx"; // ห้องตายตัวข้ามการตรวจประเภท
    },
  },
  { name: "missing equipment", type: "ROOM_EQUIPMENT", bad: ({ ds }) => (ds.rooms[1].equipment = []) },
  { name: "teacher unavailable", type: "UNAVAILABLE", bad: ({ ds }) => (ds.teachers[0].unavailable = [{ day: 0, period: 1 }]) },
  { name: "room unavailable", type: "UNAVAILABLE", bad: ({ ds }) => (ds.rooms[1].unavailable = [{ day: 0, period: 2 }]) },
  {
    name: "locked activity for group",
    type: "LOCKED",
    bad: ({ ds }) => ds.activities.push({ id: "act", code: "HR", name: "HR", day: 0, startPeriod: 1, length: 1, appliesToAll: false, teacherIds: [], groupIds: ["g1"], countsAsLoad: true }),
    good: ({ ds }) => ds.activities.push({ id: "act", code: "HR", name: "HR", day: 0, startPeriod: 4, length: 1, appliesToAll: false, teacherIds: [], groupIds: ["g1"], countsAsLoad: true }),
  },
  {
    name: "locked activity for everyone",
    type: "LOCKED",
    bad: ({ ds }) => ds.activities.push({ id: "act", code: "ALL", name: "ALL", day: 0, startPeriod: 2, length: 1, appliesToAll: true, teacherIds: [], groupIds: [], countsAsLoad: false }),
  },
  { name: "teacher over maxPerDay", type: "TEACHER_LOAD", bad: ({ ds }) => (ds.teachers[1].maxPerDay = 1) },
  { name: "teacher over maxPerWeek", type: "TEACHER_LOAD", bad: ({ ds }) => (ds.teachers[1].maxPerWeek = 1) },
  { name: "unknown room", type: "UNKNOWN_REF", bad: ({ ds, pl }) => {
    ds.assignments[0].fixedRoomId = undefined;
    pl[0].roomId = "nope";
  } },
  { name: "unknown assignment", type: "UNKNOWN_REF", bad: ({ pl }) => pl.push({ assignmentId: "zzz", block: 0, day: 0, period: 4, roomId: "r1" }) },
];

describe("validator — one minimal case per hard rule", () => {
  for (const c of cases) {
    it(`${c.type}: ${c.name}`, () => {
      const x = tiny();
      c.bad(x);
      const types = hardTypes(validate(x.ds, x.pl));
      if (c.type === "NONE") {
        expect(types).toEqual([]);
        return;
      }
      expect(new Set(types)).toEqual(new Set([c.type]));
      expect(types.length).toBe(c.count ?? 1);
      if (c.good) {
        const y = tiny();
        c.good(y);
        expect(hardTypes(validate(y.ds, y.pl))).toEqual([]);
      }
    });
  }

  it("violations carry Thai messages, entities and slots", () => {
    const x = tiny();
    x.ds.assignments.push({ id: "a3", courseId: "c1", teacherId: "t3", groupIds: ["g1"] });
    x.pl.push({ assignmentId: "a3", block: 0, day: 0, period: 1, roomId: "r3" });
    const v = validate(x.ds, x.pl).violations.find((y) => y.type === "GROUP_CLASH")!;
    expect(v.message).toMatch(/กลุ่ม G1/);
    expect(v.entities).toContainEqual({ kind: "group", id: "g1" });
    expect(v.slots).toEqual([{ day: 0, period: 1 }]);
  });

  it("student clash already explained by group clash is not double-reported", () => {
    const x = tiny();
    x.ds.students[0].extraAssignmentIds = ["a2"];
    x.pl[1].day = 1;
    x.ds.assignments.push({ id: "a3", courseId: "c1", teacherId: "t3", groupIds: ["g1"] });
    x.pl.push({ assignmentId: "a3", block: 0, day: 0, period: 1, roomId: "r3" });
    expect(hardTypes(validate(x.ds, x.pl))).toEqual(["GROUP_CLASH"]);
  });

  it("does not mutate inputs", () => {
    const x = tiny();
    const before = JSON.stringify(x);
    validate(x.ds, x.pl);
    expect(JSON.stringify(x)).toBe(before);
    expect(clone(x)).toEqual(x);
  });
});
