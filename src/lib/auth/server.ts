/**
 * ตรวจสิทธิ์ฝั่ง server สำหรับ Route Handlers
 * - verify ID token (Authorization: Bearer) ด้วย Admin SDK (checkRevoked = true)
 * - ตรวจ role และ schoolId จาก custom claims เทียบกับ getSchoolId() เสมอ (ไม่เชื่อค่าจาก body)
 */
import { ZodError } from "zod";
import { getAdmin } from "@/lib/firebase/admin";
import { getSchoolId } from "@/lib/firebase/config";
import { formatZodIssues } from "@/shared/schemas";
import type { Role } from "@/shared/types";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface UserClaims {
  role: Role;
  schoolId: string;
  teacherId?: string;
  studentId?: string;
  groupIds?: string[];
}

export interface AuthedUser {
  uid: string;
  email?: string;
  claims: UserClaims;
}

export async function requireUser(req: Request, roles: Role[]): Promise<AuthedUser> {
  const admin = await getAdmin();
  if (!admin) throw new HttpError(503, "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า Firebase Admin (ดู docs/DEPLOY.md)");
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) throw new HttpError(401, "กรุณาเข้าสู่ระบบ (ไม่พบ token)");
  let decoded;
  try {
    decoded = await admin.auth.verifyIdToken(m[1].trim(), true);
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code.includes("revoked")) throw new HttpError(401, "token ถูกเพิกถอนแล้ว กรุณาเข้าสู่ระบบใหม่");
    if (code.includes("expired")) throw new HttpError(401, "token หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    throw new HttpError(401, "token ไม่ถูกต้อง");
  }
  const role = decoded.role as Role | undefined;
  if (decoded.schoolId !== getSchoolId()) throw new HttpError(403, "บัญชีนี้ไม่ได้เป็นสมาชิกของสถานศึกษานี้");
  if (!role || !roles.includes(role)) throw new HttpError(403, "ไม่มีสิทธิ์ใช้งานส่วนนี้");
  return {
    uid: decoded.uid,
    email: decoded.email,
    claims: {
      role,
      schoolId: decoded.schoolId as string,
      teacherId: typeof decoded.teacherId === "string" ? decoded.teacherId : undefined,
      studentId: typeof decoded.studentId === "string" ? decoded.studentId : undefined,
      groupIds: Array.isArray(decoded.groupIds) ? (decoded.groupIds as string[]) : undefined,
    },
  };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** แปลงข้อผิดพลาดเป็น Response รูปแบบเดียวกันทุก route: { error, details? } */
export function jsonError(e: unknown): Response {
  if (e instanceof HttpError) {
    return json(e.details === undefined ? { error: e.message } : { error: e.message, details: e.details }, e.status);
  }
  if (e instanceof ZodError) {
    return json({ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง", details: formatZodIssues(e).slice(0, 50) }, 400);
  }
  // ไม่ส่งรายละเอียดภายในกลับไปที่ client
  console.error("[api] unexpected error:", e instanceof Error ? e.message : "unknown");
  return json({ error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, 500);
}

/** อ่าน JSON body พร้อมจำกัดขนาด (ป้องกัน payload ใหญ่ผิดปกติ) */
export async function readJson(req: Request, maxBytes = 2 * 1024 * 1024): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new HttpError(413, `ข้อมูลใหญ่เกินกำหนด (สูงสุด ${Math.round(maxBytes / 1024)} KB)`);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(413, `ข้อมูลใหญ่เกินกำหนด (สูงสุด ${Math.round(maxBytes / 1024)} KB)`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "รูปแบบ JSON ไม่ถูกต้อง");
  }
}
