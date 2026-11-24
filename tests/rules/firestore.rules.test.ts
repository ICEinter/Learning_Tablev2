/**
 * Firestore Security Rules tests (@firebase/rules-unit-testing v6)
 *
 * ต้องรันกับ Firestore Emulator เท่านั้น:
 *   npm run test:rules
 *   หรือ npx firebase-tools emulators:exec --only firestore "npx vitest run --config vitest.rules.config.ts"
 * (Emulator ต้องใช้ Java 11+; ใน CI ใช้ Java 21 — ดู .github/workflows/ci.yml)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "demo-learning-table";
const S = "school-a";
const OTHER = "school-b";
const T = "term-1";
const term = `schools/${S}/terms/${T}`;

let env: RulesTestEnvironment;

const admin = () => env.authenticatedContext("u-admin", { schoolId: S, role: "admin" });
const teacher = () => env.authenticatedContext("u-teacher", { schoolId: S, role: "teacher", teacherId: "t1" });
const student = () =>
  env.authenticatedContext("u-student", { schoolId: S, role: "student", studentId: "s1", groupIds: ["g1"] });
const otherAdmin = () => env.authenticatedContext("u-other", { schoolId: OTHER, role: "admin" });
const noRole = () => env.authenticatedContext("u-norole", { schoolId: S });
const anon = () => env.unauthenticatedContext();

const db = (ctx: RulesTestContext) => ctx.firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await f.doc(`schools/${S}`).set({ name: "โรงเรียน A", regularEndTime: "16:30", signatories: [], activeTermId: T });
    await f.doc(`schools/${OTHER}`).set({ name: "โรงเรียน B", regularEndTime: "16:30", signatories: [], activeTermId: T });
    await f.doc(term).set({ year: "2569", term: "1", status: "active" });
    await f.doc(`${term}/config/time`).set({ days: [], periods: [] });
    await f.doc(`${term}/courses/c1`).set({ code: "C1", name: "วิชา 1" });
    await f.doc(`${term}/teachers/t1`).set({ code: "T1", firstName: "ครู" });
    await f.doc(`${term}/teachers/t2`).set({ code: "T2", firstName: "ครูสอง" });
    await f.doc(`${term}/rooms/r1`).set({ code: "R1" });
    await f.doc(`${term}/groups/g1`).set({ code: "G1" });
    await f.doc(`${term}/activities/x1`).set({ code: "HR" });
    await f.doc(`${term}/assignments/a1`).set({ courseId: "c1", teacherId: "t1", groupIds: ["g1"] });
    await f.doc(`${term}/enrollments/s1`).set({ groupIds: ["g1"] });
    await f.doc(`schools/${S}/students/s1`).set({ code: "S1", displayName: "นักเรียน 1", groupId: "g1" });
    await f.doc(`schools/${S}/students/s2`).set({ code: "S2", displayName: "นักเรียน 2", groupId: "g2" });
    await f.doc(`${term}/timetables/draft1`).set({ status: "draft", entries: "", dict: { a: [], r: [] } });
    await f.doc(`${term}/timetables/pub1`).set({ status: "published", entries: "", dict: { a: [], r: [] } });
    await f.doc(`${term}/timetables/draft1/views/t_t1`).set({ rows: [] });
    await f.doc(`${term}/timetables/pub1/views/t_t1`).set({ rows: [] });
    await f.doc(`${term}/timetables/pub1/views/t_t2`).set({ rows: [] });
    await f.doc(`${term}/timetables/pub1/views/g_g1`).set({ rows: [] });
    await f.doc(`${term}/timetables/pub1/views/g_g2`).set({ rows: [] });
    await f.doc(`${term}/solverJobs/j1`).set({ status: "running" });
    await f.doc(`schools/${S}/auditLog/l1`).set({ action: "x" });
    await f.doc(`schools/${S}/importBatches/b1`).set({ status: "done" });
    await f.doc(`users/u-admin`).set({ schoolId: S, role: "admin" });
    await f.doc(`users/u-teacher`).set({ schoolId: S, role: "teacher" });
    await f.doc(`users/u-other`).set({ schoolId: OTHER, role: "admin" });
  });
});

describe("unauthenticated / ไม่มีบทบาท", () => {
  it("ผู้ไม่ได้ login อ่านอะไรไม่ได้", async () => {
    await assertFails(db(anon()).doc(`schools/${S}`).get());
    await assertFails(db(anon()).doc(`${term}/courses/c1`).get());
    await assertFails(db(anon()).doc(`${term}/timetables/pub1`).get());
    await assertFails(db(anon()).doc(`users/u-admin`).get());
  });
  it("ผู้ใช้ที่ไม่มี role claim อ่านข้อมูลสถานศึกษาไม่ได้", async () => {
    await assertFails(db(noRole()).doc(`schools/${S}`).get());
    await assertFails(db(noRole()).doc(`${term}/courses/c1`).get());
  });
});

describe("admin", () => {
  it("อ่านข้อมูลทุกส่วนของสถานศึกษาตนเองได้", async () => {
    const f = db(admin());
    for (const p of [
      `schools/${S}`,
      term,
      `${term}/config/time`,
      `${term}/courses/c1`,
      `${term}/teachers/t1`,
      `${term}/rooms/r1`,
      `${term}/groups/g1`,
      `${term}/assignments/a1`,
      `${term}/activities/x1`,
      `${term}/enrollments/s1`,
      `schools/${S}/students/s2`,
      `${term}/timetables/draft1`,
      `${term}/timetables/pub1`,
      `${term}/timetables/draft1/views/t_t1`,
      `${term}/solverJobs/j1`,
      `schools/${S}/auditLog/l1`,
      `schools/${S}/importBatches/b1`,
      `users/u-teacher`,
    ]) {
      await assertSucceeds(f.doc(p).get());
    }
    await assertSucceeds(f.collection(`${term}/timetables`).get());
  });

  it("เขียนข้อมูลหลักได้", async () => {
    const f = db(admin());
    await assertSucceeds(f.doc(`${term}/courses/c2`).set({ code: "C2", name: "ใหม่" }));
    await assertSucceeds(f.doc(`${term}/teachers/t1`).set({ code: "T1", firstName: "แก้ไข" }));
    await assertSucceeds(f.doc(`${term}/rooms/r1`).delete());
    await assertSucceeds(f.doc(`${term}/config/time`).set({ days: [], periods: [{ no: 1 }] }));
    await assertSucceeds(f.doc(`schools/${S}/students/s3`).set({ code: "S3", displayName: "x", groupId: "g1" }));
    await assertSucceeds(f.doc(`schools/${S}`).set({ name: "ใหม่", activeTermId: T }, { merge: true }));
    await assertSucceeds(f.doc(term).set({ status: "archived" }, { merge: true }));
  });

  it("เขียนฟิลด์นอกเหนือที่กำหนดใน school/term หรือแก้ publishedVersionId ไม่ได้", async () => {
    const f = db(admin());
    await assertFails(f.doc(`schools/${S}`).set({ evil: true }, { merge: true }));
    await assertFails(f.doc(term).set({ publishedVersionId: "draft1" }, { merge: true }));
    await assertFails(f.doc(`schools/${S}`).delete());
  });

  it("เขียนตาราง/views/jobs/audit/imports/users ตรงจาก client ไม่ได้ (server เท่านั้น)", async () => {
    const f = db(admin());
    await assertFails(f.doc(`${term}/timetables/new1`).set({ status: "draft" }));
    await assertFails(f.doc(`${term}/timetables/pub1`).update({ status: "archived" }));
    await assertFails(f.doc(`${term}/timetables/draft1`).delete());
    await assertFails(f.doc(`${term}/timetables/pub1/views/t_t1`).set({ rows: [1] }));
    await assertFails(f.doc(`${term}/solverJobs/j2`).set({ status: "queued" }));
    await assertFails(f.doc(`schools/${S}/auditLog/l2`).set({ action: "fake" }));
    await assertFails(f.doc(`schools/${S}/importBatches/b2`).set({ status: "done" }));
    await assertFails(f.doc(`users/u-new`).set({ schoolId: S, role: "admin" }));
  });
});

describe("teacher", () => {
  it("อ่านข้อมูลหลักที่ใช้แสดงตารางได้", async () => {
    const f = db(teacher());
    for (const p of [
      `schools/${S}`,
      term,
      `${term}/config/time`,
      `${term}/courses/c1`,
      `${term}/teachers/t2`,
      `${term}/rooms/r1`,
      `${term}/groups/g1`,
      `${term}/assignments/a1`,
      `${term}/activities/x1`,
    ]) {
      await assertSucceeds(f.doc(p).get());
    }
  });

  it("อ่านเฉพาะตารางที่เผยแพร่ — ฉบับร่างมองไม่เห็น", async () => {
    const f = db(teacher());
    await assertSucceeds(f.doc(`${term}/timetables/pub1`).get());
    await assertFails(f.doc(`${term}/timetables/draft1`).get());
    await assertSucceeds(f.collection(`${term}/timetables`).where("status", "==", "published").limit(1).get());
    await assertFails(f.collection(`${term}/timetables`).get());
  });

  it("อ่าน view ของตนเองในฉบับที่เผยแพร่เท่านั้น", async () => {
    const f = db(teacher());
    await assertSucceeds(f.doc(`${term}/timetables/pub1/views/t_t1`).get());
    await assertFails(f.doc(`${term}/timetables/pub1/views/t_t2`).get());
    await assertFails(f.doc(`${term}/timetables/pub1/views/g_g1`).get());
    await assertFails(f.doc(`${term}/timetables/draft1/views/t_t1`).get());
  });

  it("อ่านข้อมูลนักเรียน/งานคำนวณ/audit ไม่ได้ และเขียนข้อมูลหลักไม่ได้", async () => {
    const f = db(teacher());
    await assertFails(f.doc(`schools/${S}/students/s1`).get());
    await assertFails(f.doc(`${term}/enrollments/s1`).get());
    await assertFails(f.doc(`${term}/solverJobs/j1`).get());
    await assertFails(f.doc(`schools/${S}/auditLog/l1`).get());
    await assertFails(f.doc(`${term}/courses/c1`).set({ code: "HACK" }));
    await assertFails(f.doc(`${term}/teachers/t1`).update({ maxPerWeek: 1 }));
    await assertFails(f.doc(`schools/${S}`).set({ name: "x" }, { merge: true }));
  });

  it("อ่านโปรไฟล์ตนเองได้ แต่อ่านของคนอื่นไม่ได้", async () => {
    await assertSucceeds(db(teacher()).doc(`users/u-teacher`).get());
    await assertFails(db(teacher()).doc(`users/u-admin`).get());
  });
});

describe("student", () => {
  it("อ่านข้อมูลนักเรียนของตนเองเท่านั้น", async () => {
    const f = db(student());
    await assertSucceeds(f.doc(`schools/${S}/students/s1`).get());
    await assertFails(f.doc(`schools/${S}/students/s2`).get());
    await assertFails(f.collection(`schools/${S}/students`).get());
    await assertSucceeds(f.doc(`${term}/enrollments/s1`).get());
  });

  it("อ่านตารางที่เผยแพร่และ view กลุ่มของตนเองเท่านั้น", async () => {
    const f = db(student());
    await assertSucceeds(f.doc(`${term}/timetables/pub1`).get());
    await assertFails(f.doc(`${term}/timetables/draft1`).get());
    await assertSucceeds(f.doc(`${term}/timetables/pub1/views/g_g1`).get());
    await assertFails(f.doc(`${term}/timetables/pub1/views/g_g2`).get());
    await assertFails(f.doc(`${term}/timetables/pub1/views/t_t1`).get());
  });

  it("เขียนอะไรไม่ได้", async () => {
    const f = db(student());
    await assertFails(f.doc(`schools/${S}/students/s1`).set({ displayName: "แก้ชื่อ" }, { merge: true }));
    await assertFails(f.doc(`${term}/groups/g1`).set({ code: "X" }));
    await assertFails(f.doc(`${term}/timetables/pub1`).update({ status: "draft" }));
  });
});

describe("ข้ามสถานศึกษา (cross-school)", () => {
  it("admin ของสถานศึกษาอื่นอ่าน/เขียนข้อมูลไม่ได้", async () => {
    const f = db(otherAdmin());
    await assertFails(f.doc(`schools/${S}`).get());
    await assertFails(f.doc(`${term}/courses/c1`).get());
    await assertFails(f.doc(`${term}/timetables/pub1`).get());
    await assertFails(f.doc(`${term}/timetables/pub1/views/g_g1`).get());
    await assertFails(f.doc(`schools/${S}/students/s1`).get());
    await assertFails(f.doc(`users/u-admin`).get());
    await assertFails(f.doc(`${term}/courses/c9`).set({ code: "X" }));
    await assertFails(f.doc(`schools/${S}`).set({ name: "ยึด" }, { merge: true }));
  });

  it("admin อ่านสถานศึกษาตนเองได้ (ควบคุม)", async () => {
    await assertSucceeds(db(otherAdmin()).doc(`schools/${OTHER}`).get());
    await assertSucceeds(db(otherAdmin()).doc(`users/u-other`).get());
  });
});
