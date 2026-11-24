/**
 * เรียก /api/admin/users พร้อม ID token — โหลดโมดูล Firebase แบบ dynamic เฉพาะโหมด Firebase
 */
import type { Role } from "@/shared/types";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  teacherId?: string;
  studentId?: string;
  disabled: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role: Role;
  teacherId?: string;
  studentId?: string;
}

function friendlyError(status: number, message: string | undefined): string {
  if (status === 503) return "ยังไม่ได้ตั้งค่า Firebase Admin บนเซิร์ฟเวอร์ (ตรวจสอบตัวแปรสภาพแวดล้อมของบัญชีบริการ)";
  if (status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  if (status === 403) return "บัญชีนี้ไม่มีสิทธิ์จัดการผู้ใช้";
  if (status === 409) return message ?? "อีเมลนี้ถูกใช้แล้ว";
  return message ?? `คำขอไม่สำเร็จ (HTTP ${status})`;
}

async function call<T>(method: "GET" | "POST", body?: CreateUserInput): Promise<T> {
  const { getIdToken } = await import("@/lib/auth/firebase-auth");
  const token = await getIdToken();
  if (!token) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  let res: Response;
  try {
    res = await fetch("/api/admin/users", {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  }
  const data: unknown = await res.json().catch(() => null);
  const errorText = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : undefined;
  if (!res.ok || errorText) throw new Error(friendlyError(res.status, errorText));
  return data as T;
}

export async function listUsers(): Promise<AdminUser[]> {
  const r = await call<{ users?: AdminUser[] }>("GET");
  return r.users ?? [];
}

export async function createUser(input: CreateUserInput): Promise<string> {
  const r = await call<{ uid: string }>("POST", input);
  return r.uid;
}
