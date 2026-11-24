"use client";
/**
 * DataProvider — สถานะข้อมูลของแอป + action ทั้งหมด (CRUD, ตาราง, เผยแพร่)
 * ใช้ Firebase สำหรับบัญชีจริงเมื่อมี config; Demo ใช้ LocalRepository แยกในเบราว์เซอร์
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { validate } from "@/engine";
import { createMockDataset } from "@/data/mock";
import { createRayongDataset, createOfficialRayongTimetable } from "@/data/rayong";
import { isDemoSession } from "@/lib/auth/demo-session";
import { useSession } from "@/lib/auth/session-context";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { Dataset, EntityKind, EntityOf, ID, Session, TimetableVersion } from "@/shared/types";
import { LocalRepository } from "./local-repository";
import type { Repository, SettingsPatch } from "./repository";

export interface DataContextValue {
  ready: boolean;
  error: string | null;
  mode: "local" | "firebase";
  dataset: Dataset;
  timetables: TimetableVersion[];
  published: TimetableVersion | undefined;
  upsert: <K extends EntityKind>(kind: K, items: EntityOf<K>[]) => Promise<void>;
  remove: (kind: EntityKind, ids: ID[]) => Promise<void>;
  saveSettings: (patch: SettingsPatch) => Promise<void>;
  saveTimetable: (tt: TimetableVersion) => Promise<void>;
  deleteTimetable: (id: ID) => Promise<void>;
  /** เผยแพร่ได้เฉพาะตารางที่ validator ยืนยัน Hard = 0 */
  publishTimetable: (id: ID) => Promise<{ ok: boolean; message: string }>;
  resetToMock: () => Promise<void>;
  loadRayongData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

async function createRepository(session: Session | null): Promise<Repository> {
  if (isFirebaseConfigured() && session && !isDemoSession(session)) {
    const mod = await import("./firestore-repository");
    return mod.createFirestoreRepository();
  }
  return new LocalRepository();
}

export function DataProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<Repository | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"local" | "firebase">("local");
  const [dataset, setDataset] = useState<Dataset>(() => createRayongDataset());
  const [timetables, setTimetables] = useState<TimetableVersion[]>([]);

  const reload = useCallback(async () => {
    const repo = repoRef.current;
    if (!repo) return;
    const snap = await repo.load();
    setDataset(snap.dataset);
    setTimetables(snap.timetables);
  }, []);

  const { session, ready: sessionReady } = useSession();
  const sessionKey = session ? `${session.uid}:${session.role}` : "anon";

  useEffect(() => {
    if (!sessionReady) return;
    let alive = true;
    setReady(false);
    setError(null);
    repoRef.current = null;
    setMode(isFirebaseConfigured() && session && !isDemoSession(session) ? "firebase" : "local");
    (async () => {
      try {
        const repo = await createRepository(session);
        if (!alive) return;
        repoRef.current = repo;
        setMode(repo.mode);
        const snap = await repo.load();
        if (!alive) return;
        setDataset(snap.dataset);
        setTimetables(snap.timetables);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
    // โหลดใหม่เมื่อผู้ใช้เปลี่ยน (โหมด Firebase อ่านข้อมูลตามสิทธิ์ของผู้ใช้)
  }, [sessionReady, sessionKey, session]);

  const withRepo = useCallback(async (fn: (r: Repository) => Promise<void>) => {
    const repo = repoRef.current;
    if (!repo) throw new Error("ยังโหลดข้อมูลไม่เสร็จ");
    await fn(repo);
    const snap = await repo.load();
    setDataset(snap.dataset);
    setTimetables(snap.timetables);
  }, []);

  const clearAllData = useCallback(async () => {
    await withRepo(async (repo) => {
      if ("clearAll" in repo && typeof (repo as { clearAll: () => Promise<void> }).clearAll === "function") {
        await (repo as { clearAll: () => Promise<void> }).clearAll();
      } else {
        const empty = {
          ...dataset,
          courses: [],
          teachers: [],
          rooms: [],
          groups: [],
          students: [],
          assignments: [],
          activities: [],
        };
        await repo.replaceAll(empty, []);
      }
      await reload();
    });
  }, [withRepo, dataset, reload]);

  const value = useMemo<DataContextValue>(
    () => ({
      ready,
      error,
      mode,
      dataset,
      timetables,
      published: timetables.find((t) => t.status === "published"),
      upsert: (kind, items) => withRepo((r) => r.upsert(kind, items)),
      remove: (kind, ids) => withRepo((r) => r.remove(kind, ids)),
      saveSettings: (patch) => withRepo((r) => r.saveSettings(patch)),
      saveTimetable: (tt) => withRepo((r) => r.saveTimetable(tt)),
      deleteTimetable: (id) => withRepo((r) => r.deleteTimetable(id)),
      publishTimetable: async (id) => {
        const tt = timetables.find((t) => t.id === id);
        if (!tt) return { ok: false, message: "ไม่พบตาราง" };
        const v = validate(dataset, tt.placements);
        if (v.score.hard > 0) return { ok: false, message: `เผยแพร่ไม่ได้: ยังมีข้อขัดแย้ง Hard ${v.score.hard} รายการ` };
        await withRepo((r) => r.publishTimetable(id));
        return { ok: true, message: "เผยแพร่แล้ว" };
      },
      resetToMock: () => withRepo((r) => r.replaceAll(createRayongDataset(), [createOfficialRayongTimetable()])),
      loadRayongData: async () => {
        const ds = createRayongDataset();
        const tt = createOfficialRayongTimetable(ds);
        await withRepo((r) => r.replaceAll(ds, [tt]));
        try {
          await fetch("/api/admin/seed", { method: "POST" });
        } catch {
          /* ignore if offline */
        }
        await reload();
      },
      clearAllData,
      reload,
    }),
    [ready, error, mode, dataset, timetables, withRepo, clearAllData, reload],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData ต้องอยู่ภายใน <DataProvider>");
  return ctx;
}
