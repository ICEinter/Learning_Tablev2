import { isAdminConfigured } from "@/lib/firebase/admin";
import { isFirebaseConfigured, useEmulator as isEmulatorEnabled } from "@/lib/firebase/config";
import { json } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** สถานะการตั้งค่า (ไม่มีค่าลับใด ๆ ในผลลัพธ์) */
export async function GET(): Promise<Response> {
  return json({
    firebaseClientConfigured: isFirebaseConfigured(),
    firebaseAdminConfigured: isAdminConfigured(),
    emulator: isEmulatorEnabled() || Boolean(process.env.FIRESTORE_EMULATOR_HOST),
    time: new Date().toISOString(),
  });
}
