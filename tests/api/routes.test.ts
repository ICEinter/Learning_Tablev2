/**
 * ทดสอบ Route Handlers โดยเรียกฟังก์ชันตรง ๆ (ไม่ต้องมี Firebase / ไม่ต้องรัน next dev)
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockDataset } from "@/data/mock";
import { GET as health } from "@/app/api/health/route";
import { POST as validateRoute } from "@/app/api/validate/route";
import { POST as saveTimetable } from "@/app/api/timetables/route";
import { DELETE as deleteTimetable } from "@/app/api/timetables/[id]/route";
import { POST as publishTimetable } from "@/app/api/timetables/[id]/publish/route";
import { GET as listUsers, POST as createUser } from "@/app/api/admin/users/route";

const FIREBASE_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_USE_EMULATOR",
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
];

let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = Object.fromEntries(FIREBASE_ENV.map((k) => [k, process.env[k]]));
  for (const k of FIREBASE_ENV) delete process.env[k];
});
afterEach(() => {
  for (const k of FIREBASE_ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/health", () => {
  it("รายงานว่ายังไม่ได้ตั้งค่า Firebase และไม่มีค่าลับในผลลัพธ์", async () => {
    const res = await health();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ firebaseClientConfigured: false, firebaseAdminConfigured: false, emulator: false });
    expect(typeof body.time).toBe("string");
    expect(Object.keys(body).sort()).toEqual(["emulator", "firebaseAdminConfigured", "firebaseClientConfigured", "time"]);
  });

  it("apiKey ที่ถูกปิดบังถือว่ายังไม่ได้ตั้งค่า", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "AIza****************";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "x.firebaseapp.com";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "x";
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:2:web:3";
    const body = await (await health()).json();
    expect(body.firebaseClientConfigured).toBe(false);
  });
});

describe("POST /api/validate (โหมดสาธิต)", () => {
  it("ตรวจข้อมูลจำลองกับตารางว่าง → มี Hard violation ชนิด PERIOD_COUNT", async () => {
    const res = await validateRoute(post("/api/validate", { dataset: createMockDataset(), placements: [] }));
    const body = await res.json();
    expect(res.status, JSON.stringify(body).slice(0, 300)).toBe(200);
    expect(body.score.hard).toBeGreaterThan(0);
    expect(body.violations.some((v: { type: string }) => v.type === "PERIOD_COUNT")).toBe(true);
  });

  it("body ผิดรูปแบบ → 400 พร้อมรายละเอียด", async () => {
    const res = await validateRoute(post("/api/validate", { dataset: { school: {} }, placements: "x" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("JSON เสีย → 400", async () => {
    const res = await validateRoute(post("/api/validate", "{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/JSON/);
  });

  it("payload ใหญ่เกิน 2MB → 413", async () => {
    const big = JSON.stringify({ dataset: createMockDataset(), placements: [], pad: "x".repeat(2 * 1024 * 1024 + 10) });
    const res = await validateRoute(post("/api/validate", big));
    expect(res.status).toBe(413);
  });
});

describe("routes ของ admin เมื่อยังไม่ได้ตั้งค่า Firebase Admin → 503", () => {
  const cases: [string, () => Promise<Response>][] = [
    ["POST /api/timetables", () => saveTimetable(post("/api/timetables", { timetable: {} }))],
    ["POST /api/timetables/[id]/publish", () => publishTimetable(post("/api/timetables/tt-1/publish", {}), params("tt-1"))],
    [
      "DELETE /api/timetables/[id]",
      () => deleteTimetable(new Request("http://localhost/api/timetables/tt-1", { method: "DELETE" }), params("tt-1")),
    ],
    ["GET /api/admin/users", () => listUsers(new Request("http://localhost/api/admin/users"))],
    ["POST /api/admin/users", () => createUser(post("/api/admin/users", { email: "a@b.co" }))],
  ];
  for (const [name, call] of cases) {
    it(name, async () => {
      const res = await call();
      expect(res.status).toBe(503);
      expect((await res.json()).error).toMatch(/Firebase Admin/);
    });
  }
});

describe("Admin ถูกตั้งค่า (emulator host ปลอม) แต่ไม่มี token หรือ token ผิด → 401", () => {
  beforeEach(() => {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:1";
  });

  it("ไม่มี Authorization header", async () => {
    const res = await saveTimetable(post("/api/timetables", { timetable: {} }));
    expect(res.status).toBe(401);
  });

  it("/api/validate ไม่อนุญาตแบบไม่ login เมื่อไม่ใช่โหมดสาธิต", async () => {
    const res = await validateRoute(post("/api/validate", { dataset: createMockDataset(), placements: [] }));
    expect(res.status).toBe(401);
  });

  it("token ปลอม", async () => {
    const res = await listUsers(
      new Request("http://localhost/api/admin/users", { headers: { Authorization: "Bearer not-a-jwt" } }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/token/);
  });

  it("POST /api/ai/advisor ให้คำวิเคราะห์แบบ rule-based เมื่อไม่มี API key (fallback ปลอดภัย)", async () => {
    const { POST: advisorRoute } = await import("@/app/api/ai/advisor/route");
    const req = post("/api/ai/advisor", {
      algorithm: "ga",
      seed: 42,
      hard: 0,
      soft: 12.5,
      elapsedMs: 2500,
      placementsCount: 35,
      breakdown: { teacherGaps: 2, studentGaps: 1 },
      explanations: ["ตารางผ่านเกณฑ์"],
    });
    const res = await advisorRoute(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("rule-based");
    expect(data.executiveSummary).toBeTruthy();
    expect(data.strengths.length).toBeGreaterThan(0);
    expect(data.recommendations.length).toBeGreaterThan(0);
  });
});
