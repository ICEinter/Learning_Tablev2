/** Firebase service-account env parsing shared by Admin SDK and Worker-safe REST code. */
export interface FirebaseServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function getFirebaseServiceAccount(): FirebaseServiceAccount | null {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() || process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) return null;

  const privateKey = rawKey.trim().replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  if (!privateKey.includes("PRIVATE KEY")) return null;
  return { projectId, clientEmail, privateKey };
}
