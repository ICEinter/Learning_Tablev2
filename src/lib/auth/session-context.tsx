"use client";
/**
 * SessionProvider — สถานะผู้ใช้
 *  - โหมดสาธิต (เลือกเองก่อนสมัคร): เลือกบทบาท/บุคคลตัวอย่างที่หน้า login และใช้ LocalRepository
 *  - โหมด Firebase: Firebase Authentication + custom claims {role, schoolId, teacherId, studentId, groupIds}
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { isDemoSession } from "@/lib/auth/demo-session";
import type { Role, Session } from "@/shared/types";

const DEMO_KEY = "learning-table:demo-session";

export interface SessionContextValue {
  ready: boolean;
  mode: "demo" | "firebase";
  session: Session | null;
  signInDemo: (s: Session) => void;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    role: Role,
    meta?: { teacherId?: string; studentId?: string; groupIds?: string[] },
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  setModeOverride?: (mode: "demo" | "firebase") => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const firebase = isFirebaseConfigured();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let alive = true;

    // อ่าน cached session จาก localStorage ก่อนเสมอ เพื่อให้ผู้ใช้เข้าถึงได้ทันที
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as Session;
        if (isDemoSession(cached)) {
          queueMicrotask(() => {
            if (alive) setSession(cached);
          });
        }
        else localStorage.removeItem(DEMO_KEY);
      }
    } catch {
      /* ignore */
    }

    if (!firebase) {
      queueMicrotask(() => {
        if (alive) setReady(true);
      });
    } else {
      import("./firebase-auth").then((m) => {
        if (!alive) return;
        unsub = m.onFirebaseSession((s, hasFirebaseUser) => {
          if (s) {
            // A real Firebase session always takes precedence over a cached Demo session.
            try {
              localStorage.removeItem(DEMO_KEY);
            } catch {
              /* ignore */
            }
            setSession(s);
          } else if (hasFirebaseUser) {
            // A signed-in Firebase account without valid school claims must never fall back to a cached Demo session.
            try {
              localStorage.removeItem(DEMO_KEY);
            } catch {
              /* ignore */
            }
            setSession(null);
          } else {
            try {
              const raw = localStorage.getItem(DEMO_KEY);
              const cached = raw ? (JSON.parse(raw) as Session) : null;
              if (isDemoSession(cached)) setSession(cached);
            } catch {
              /* ignore invalid cached demo session */
            }
          }
          setReady(true);
        });
      }).catch(() => {
        if (alive) setReady(true);
      });
    }
    return () => {
      alive = false;
      unsub?.();
    };
  }, [firebase]);

  const signInDemo = useCallback((s: Session) => {
    setSession(s);
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    const m = await import("./firebase-auth");
    const s = await m.firebaseSignIn(email, password);
    if (s) {
      try {
        localStorage.removeItem(DEMO_KEY);
      } catch {
        /* ignore */
      }
      setSession(s);
    }
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      role: Role,
      meta?: { teacherId?: string; studentId?: string; groupIds?: string[] },
    ) => {
      const m = await import("./firebase-auth");
      const s = await m.firebaseSignUp(email, password, displayName, role, meta);
      if (s) {
        try {
          localStorage.removeItem(DEMO_KEY);
        } catch {
          /* ignore */
        }
        setSession(s);
      }
    },
    [],
  );

  const resetPassword = useCallback(
    async (email: string) => {
      if (!firebase) throw new Error("ยังไม่ได้ตั้งค่า Firebase สำหรับระบบบัญชีปกติ");
      const m = await import("./firebase-auth");
      await m.firebaseResetPassword(email);
    },
    [firebase],
  );

  const signOut = useCallback(async () => {
    if (firebase) {
      const m = await import("./firebase-auth");
      await m.firebaseSignOut();
    }
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
  }, [firebase]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ready,
      mode: !firebase || isDemoSession(session) ? "demo" : "firebase",
      session,
      signInDemo,
      signInEmail,
      signUp,
      resetPassword,
      signOut,
      hasRole: (...roles) => Boolean(session && roles.includes(session.role)),
    }),
    [ready, firebase, session, signInDemo, signInEmail, signUp, resetPassword, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession ต้องอยู่ภายใน <SessionProvider>");
  return ctx;
}
