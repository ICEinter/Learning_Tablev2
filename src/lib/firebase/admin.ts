/**
 * Firebase Admin SDK (ฝั่ง server เท่านั้น)
 * อ่าน service account จาก env 3 ตัว (FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY)
 * หรือใช้ Emulator เมื่อมี FIRESTORE_EMULATOR_HOST — ห้าม log ค่าลับใด ๆ
 */
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { getFirebaseServiceAccount } from "./service-account";
export { getFirebaseServiceAccount } from "./service-account";

// แพ็กเกจ "server-only" ไม่ได้ติดตั้ง จึงป้องกันด้วย runtime guard แทน
if (typeof window !== "undefined") {
  throw new Error("firebase-admin ใช้ได้เฉพาะฝั่ง server");
}

export interface AdminHandles {
  app: App;
  auth: Auth;
  db: Firestore;
}

const APP_NAME = "learning-table-admin";
let cached: AdminHandles | null = null;

function emulatorHost(): string | undefined {
  return process.env.FIRESTORE_EMULATOR_HOST || undefined;
}

/** ตั้งค่า Admin SDK แล้วหรือไม่ (ไม่ initialize, ไม่คืนค่าลับ) */
export function isAdminConfigured(): boolean {
  return Boolean(emulatorHost() || getFirebaseServiceAccount());
}

/** คืน handles ของ Admin SDK หรือ null ถ้ายังไม่ได้ตั้งค่า */
export async function getAdmin(): Promise<AdminHandles | null> {
  if (cached) return cached;
  const creds = getFirebaseServiceAccount();
  const emu = emulatorHost();
  if (!creds && !emu) return null;

  // Defer the Node-only Admin SDK until a Firebase server route actually needs it.
  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/auth"),
    import("firebase-admin/firestore"),
  ]);

  let app: App;
  if (appSdk.getApps().some((a) => a.name === APP_NAME)) {
    app = appSdk.getApp(APP_NAME);
  } else if (creds) {
    app = appSdk.initializeApp({ credential: appSdk.cert(creds), projectId: creds.projectId }, APP_NAME);
  } else {
    // Emulator: ไม่ต้องมี credential; Admin SDK อ่าน FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST เอง
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      "demo-learning-table";
    app = appSdk.initializeApp({ projectId }, APP_NAME);
  }
  const db = firestoreSdk.getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* settings ถูกตั้งไปแล้ว (เช่น hot reload) */
  }
  cached = { app, auth: authSdk.getAuth(app), db };
  return cached;
}
