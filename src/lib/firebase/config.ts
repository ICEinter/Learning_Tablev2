/**
 * Firebase client configuration จาก environment variables (NEXT_PUBLIC_*)
 * หมายเหตุ: ค่าเหล่านี้ไม่ใช่ความลับและไม่ใช่กลไกควบคุมสิทธิ์ —
 * สิทธิ์ควบคุมด้วย Firebase Authentication + Firestore Security Rules + ตรวจฝั่ง server
 */
export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export function getFirebaseConfig(): FirebaseClientConfig | null {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  // apiKey ที่ถูกปิดบัง (เช่น "AIza****") ใช้รันจริงไม่ได้ — ถือว่ายังไม่ตั้งค่า
  const masked = /\*|x{4,}|your[-_]?api/i.test(cfg.apiKey);
  if (!cfg.apiKey || masked || !cfg.projectId || !cfg.appId || !cfg.authDomain) return null;
  return cfg;
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

export function useEmulator(): boolean {
  return process.env.NEXT_PUBLIC_USE_EMULATOR === "true";
}

/** schoolId ของการติดตั้งนี้ (ระยะแรก 1 สถานศึกษาต่อการติดตั้ง) */
export function getSchoolId(): string {
  return process.env.NEXT_PUBLIC_SCHOOL_ID || "school-demo";
}
