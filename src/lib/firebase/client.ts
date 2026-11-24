/**
 * Firebase client SDK (เบราว์เซอร์) — lazy singleton
 * ใช้เฉพาะเมื่อ isFirebaseConfigured() เป็นจริง (โหมดสาธิตจะไม่โหลดไฟล์นี้เลย)
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseConfig, useEmulator as isEmulatorEnabled } from "./config";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const cfg = getFirebaseConfig();
  if (!cfg) throw new Error("ยังไม่ได้ตั้งค่า Firebase (ต้องใส่ค่า NEXT_PUBLIC_FIREBASE_* จริงใน .env.local)");
  app = getApps().length ? getApp() : initializeApp(cfg);
  return app;
}

export function getClientAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  if (isEmulatorEnabled()) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  return auth;
}

export function getClientDb(): Firestore {
  if (db) return db;
  const fbApp = getFirebaseApp();
  try {
    // persistent cache (IndexedDB) ลด reads เมื่อเปิดซ้ำ — ใช้ได้เฉพาะในเบราว์เซอร์
    db =
      typeof window !== "undefined" && typeof indexedDB !== "undefined"
        ? initializeFirestore(fbApp, {
            ignoreUndefinedProperties: true,
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          })
        : initializeFirestore(fbApp, { ignoreUndefinedProperties: true });
  } catch {
    // ถูก initialize ไปแล้ว (เช่น HMR) — ใช้ instance เดิม
    db = getFirestore(fbApp);
  }
  if (isEmulatorEnabled()) {
    try {
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    } catch {
      /* เชื่อมแล้ว */
    }
  }
  return db;
}

export function getClientStorage(): FirebaseStorage {
  if (storage) return storage;
  const fbApp = getFirebaseApp();
  storage = getStorage(fbApp);
  if (isEmulatorEnabled()) {
    try {
      connectStorageEmulator(storage, "127.0.0.1", 9199);
    } catch {
      /* เชื่อมแล้ว */
    }
  }
  return storage;
}