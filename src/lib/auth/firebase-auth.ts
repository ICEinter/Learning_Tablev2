/**
 * Firebase Authentication (ฝั่ง client)
 * สิทธิ์มาจาก custom claims {role, schoolId, teacherId?, studentId?, groupIds?}
 * ซึ่งตั้งได้เฉพาะฝั่ง server (Admin SDK) — client อ่านเพื่อแสดงผลเท่านั้น
 * การบังคับสิทธิ์จริงอยู่ที่ Firestore Security Rules และ requireUser() ฝั่ง server
 */
import {
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getSchoolId } from "@/lib/firebase/config";
import { getClientAuth } from "@/lib/firebase/client";
import type { Role, Session } from "@/shared/types";

const ROLES: Role[] = ["admin", "teacher", "student"];

export interface AuthClaims {
  role?: unknown;
  schoolId?: unknown;
  teacherId?: unknown;
  studentId?: unknown;
  groupIds?: unknown;
}

/** แปลงเฉพาะ custom claims ที่ตรวจสอบแล้วเป็น Session */
export function claimsToSession(
  user: Pick<User, "uid" | "displayName" | "email">,
  claims: AuthClaims,
  schoolId = getSchoolId(),
): Session | null {
  const role = claims.role;
  if (typeof role !== "string" || !ROLES.includes(role as Role)) {
    console.warn("[auth] บัญชีนี้ยังไม่ได้รับบทบาท (ไม่มี custom claim 'role') — ให้ผู้ดูแลระบบกำหนดสิทธิ์ก่อน");
    return null;
  }
  if (typeof claims.schoolId !== "string" || claims.schoolId !== schoolId) {
    console.warn("[auth] บัญชีนี้ไม่ได้เป็นสมาชิกของสถานศึกษานี้ (schoolId ใน claims ไม่ตรง)");
    return null;
  }

  return {
    uid: user.uid,
    role: role as Role,
    displayName: user.displayName || user.email || "ผู้ใช้",
    teacherId: typeof claims.teacherId === "string" ? claims.teacherId : undefined,
    studentId: typeof claims.studentId === "string" ? claims.studentId : undefined,
    groupIds: Array.isArray(claims.groupIds) ? claims.groupIds.filter((g): g is string => typeof g === "string") : undefined,
  };
}

export async function firebaseSignIn(email: string, password: string): Promise<Session> {
  const normEmail = email.trim().toLowerCase();
  const auth = getClientAuth();
  try {
    const cred = await signInWithEmailAndPassword(auth, normEmail, password);
    const res = await cred.user.getIdTokenResult(true);
    const s = claimsToSession(cred.user, res.claims as AuthClaims);
    if (!s) {
      await signOut(auth);
      throw new Error("บัญชีนี้ยังไม่ได้รับ schoolId และ role ที่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ");
    }
    return s;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (/wrong-password|invalid-email|invalid-credential|user-not-found/.test(code)) {
      throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }
    if (code.includes("configuration-not-found")) {
      throw new Error("ยังไม่ได้เปิดใช้งาน Email/Password ใน Firebase Console");
    }
    if (code.includes("too-many-requests")) throw new Error("พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่");
    if (code.includes("network")) throw new Error("เชื่อมต่อเครือข่ายไม่ได้");
    if (e instanceof Error && (!code || e.message.includes("schoolId"))) throw e;
    throw new Error("เข้าสู่ระบบไม่สำเร็จ");
  }
}

export async function firebaseSignUp(
  email: string,
  password: string,
  displayName: string,
  role: Role,
  meta?: { teacherId?: string; studentId?: string; groupIds?: string[] },
): Promise<Session> {
  const normEmail = email.trim().toLowerCase();
  try {
    const auth = getClientAuth();
    if (role === "admin") throw new Error("ไม่สามารถสมัครบัญชี admin จากหน้าเว็บได้");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normEmail,
        password,
        displayName: displayName.trim(),
        role,
        teacherId: meta?.teacherId,
        studentId: meta?.studentId,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(result.error || "เซิร์ฟเวอร์สร้างบัญชีไม่สำเร็จ");

    const cred = await signInWithEmailAndPassword(auth, normEmail, password);
    const tokenResult = await cred.user.getIdTokenResult(true);
    const session = claimsToSession(cred.user, tokenResult.claims as AuthClaims);
    if (!session) {
      await signOut(auth);
      throw new Error("สร้างบัญชีแล้ว แต่ยังอ่าน schoolId และ role จาก token ไม่ได้ กรุณาเข้าสู่ระบบใหม่หรือติดต่อผู้ดูแลระบบ");
    }
    return session;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code.includes("email-already-in-use")) {
      throw new Error("อีเมลนี้ถูกใช้งานแล้วใน Firebase Console กรุณาเข้าสู่ระบบ");
    }
    if (code.includes("configuration-not-found")) throw new Error("ยังไม่ได้เปิดใช้งาน Email/Password ใน Firebase Console");
    if (code.includes("invalid-email")) throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
    if (code.includes("weak-password")) throw new Error("รหัสผ่านต้องมีความปลอดภัยมากกว่านี้");
    if (code.includes("network")) throw new Error("เชื่อมต่อเครือข่ายไม่ได้");
    if (e instanceof Error && !code) throw e;
    throw new Error("สมัครสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง");
  }
}

export async function firebaseResetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getClientAuth(), email.trim());
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code.includes("user-not-found")) throw new Error("ไม่พบบัญชีที่ใช้อีเมลนี้");
    if (code.includes("invalid-email")) throw new Error("รูปแบบอีเมลไม่ถูกต้อง");
    throw new Error("ส่งอีเมลรีเซ็ตรหัสผ่านไม่สำเร็จ");
  }
}

export async function firebaseSignOut(): Promise<void> {
  await signOut(getClientAuth());
}

export function onFirebaseSession(cb: (s: Session | null, hasFirebaseUser: boolean) => void): () => void {
  let refreshedUid: string | null = null;
  const auth = getClientAuth();
  return onIdTokenChanged(auth, async (user) => {
    if (!user) {
      refreshedUid = null;
      return cb(null, false);
    }
    try {
      // Refresh once at auth restoration/sign-in so newly assigned claims are read before data queries.
      const forceRefresh = refreshedUid !== user.uid;
      refreshedUid = user.uid;
      const res = await user.getIdTokenResult(forceRefresh);
      const session = claimsToSession(user, res.claims as AuthClaims);
      if (!session) {
        cb(null, true);
        await signOut(auth);
        return;
      }
      cb(session, true);
    } catch (e) {
      console.warn("[auth] อ่าน token ไม่สำเร็จ", e instanceof Error ? e.message : e);
      cb(null, true);
    }
  });
}

/** ID token สำหรับแนบ Authorization: Bearer กับ /api/* (forceRefresh หลังเปลี่ยน claims) */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = getClientAuth().currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}

/** claims ปัจจุบันของผู้ใช้ที่ login (ใช้ใน repository เพื่อเลือกข้อมูลที่ rules อนุญาต) */
export async function getCurrentSession(): Promise<Session | null> {
  const auth = getClientAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  const res = await user.getIdTokenResult(true);
  return claimsToSession(user, res.claims as AuthClaims);
}

/** fetch ไปยัง API ของแอปพร้อมแนบ ID token */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  if (!token) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}
