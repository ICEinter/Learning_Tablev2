import type { Role } from "@/shared/types";
import { getFirebaseServiceAccount } from "./service-account";

export interface FirebaseCustomClaims {
  schoolId: string;
  role: Role;
  teacherId?: string;
  studentId?: string;
  groupIds?: string[];
}

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const IDENTITY_TOOLKIT_SCOPE = "https://www.googleapis.com/auth/identitytoolkit";
const encoder = new TextEncoder();

let cachedToken:
  | {
      clientEmail: string;
      accessToken: string;
      expiresAt: number;
    }
  | undefined;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodePrivateKey(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  if (!body) throw new Error("Firebase service account private key is empty");
  const decoded = atob(body);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  if (cachedToken?.clientEmail === clientEmail && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64Url(
    encoder.encode(
      JSON.stringify({
        iss: clientEmail,
        scope: IDENTITY_TOOLKIT_SCOPE,
        aud: OAUTH_TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const unsignedJwt = header + "." + payload;
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    decodePrivateKey(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signingKey, encoder.encode(unsignedJwt));
  const assertion = unsignedJwt + "." + base64Url(new Uint8Array(signature));

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error("Google OAuth token exchange failed (" + response.status + "): " + (body.error_description ?? "request rejected"));
  }

  cachedToken = {
    clientEmail,
    accessToken: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

/** Sets Firebase Auth custom claims through the Identity Toolkit REST API.
 * This avoids loading firebase-admin/auth in Cloudflare Workers.
 */
export async function setFirebaseCustomClaims(uid: string, claims: FirebaseCustomClaims): Promise<void> {
  if (!uid.trim()) throw new Error("Firebase Auth UID is required");
  if (!claims.schoolId.trim()) throw new Error("schoolId custom claim is required");
  if (!["admin", "teacher", "student"].includes(claims.role)) throw new Error("Invalid role custom claim");

  const serializedClaims = JSON.stringify(claims);
  if (encoder.encode(serializedClaims).byteLength > 1000) {
    throw new Error("Firebase custom claims must be 1000 bytes or less");
  }

  const account = getFirebaseServiceAccount();
  if (!account) throw new Error("Firebase Admin service account is not configured");

  const accessToken = await getGoogleAccessToken(account.clientEmail, account.privateKey);
  const endpoint =
    "https://identitytoolkit.googleapis.com/v1/projects/" +
    encodeURIComponent(account.projectId) +
    "/accounts:update";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      localId: uid,
      customAttributes: serializedClaims,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(
      "Firebase Auth custom claims update failed (" + response.status + "): " + (body.error?.message ?? "request rejected"),
    );
  }
}
