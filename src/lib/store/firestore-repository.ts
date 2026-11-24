/**
 * FirestoreRepository — โหมด Firebase (Cloud Firestore)
 *
 * เส้นทางข้อมูล (ดู docs/FIREBASE.md):
 *   schools/{schoolId}                               ข้อมูลสถานศึกษา + activeTermId
 *   schools/{schoolId}/students/{id}                  นักเรียน (PII ขั้นต่ำ)
 *   schools/{schoolId}/terms/{termId}                 ภาคเรียน
 *   schools/{schoolId}/terms/{termId}/config/time     โครงสร้างเวลา
 *   schools/{schoolId}/terms/{termId}/{courses|teachers|rooms|groups|assignments|activities}/{id}
 *   schools/{schoolId}/terms/{termId}/timetables/{id} ตาราง (เขียนผ่าน server API เท่านั้น)
 *
 * หลักการลดต้นทุน: อ่านครั้งเดียวด้วย getDocs (ไม่ใช้ realtime listener กับข้อมูลจำนวนมาก),
 * เก็บ snapshot ในหน่วยความจำและอัปเดตเฉพาะส่วนที่เขียน, batch ละไม่เกิน 450 ops
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { createRayongDataset } from "@/data/rayong";
import { authedFetch, getCurrentSession } from "@/lib/auth/firebase-auth";
import { getClientDb } from "@/lib/firebase/client";
import { getSchoolId } from "@/lib/firebase/config";
import {
  TERM_ENTITY_KINDS,
  fsPaths,
  schoolToDoc,
  stripId,
  termToDoc,
  timetableFromDoc,
  withId,
  type SchoolDoc,
  type TermDoc,
  type TimetableDoc,
} from "@/shared/codec";
import type { Dataset, EntityKind, EntityOf, ID, Session, TimeStructure, TimetableVersion } from "@/shared/types";
import type { Repository, SettingsPatch, Snapshot } from "./repository";

const BATCH_LIMIT = 450;
const CACHE_TTL_MS = 30_000;

type Op = { kind: "set"; ref: DocumentReference; data: DocumentData; merge?: boolean } | { kind: "delete"; ref: DocumentReference };

function emptyDataset(schoolId: string): Dataset {
  const mock = createRayongDataset();
  return {
    school: { ...mock.school, id: schoolId },
    term: mock.term,
    time: mock.time,
    courses: [],
    teachers: [],
    rooms: [],
    groups: [],
    students: [],
    assignments: [],
    activities: [],
    workloadRules: mock.workloadRules,
  };
}

function friendly(e: unknown): Error {
  const code = (e as { code?: string }).code ?? "";
  if (code.includes("permission-denied")) return new Error("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้ (Firestore Security Rules ปฏิเสธ)");
  if (code.includes("unavailable")) return new Error("เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบเครือข่าย");
  return e instanceof Error ? e : new Error(String(e));
}

async function callApi<T>(path: string, init: RequestInit): Promise<T> {
  const res = await authedFetch(path, init);
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(body.error || `คำขอล้มเหลว (HTTP ${res.status})`);
  return body;
}

class FirestoreRepository implements Repository {
  readonly mode = "firebase" as const;
  private cache: Snapshot | null = null;
  private fetchedAt = 0;
  private termId: string;
  private bootstrapped = false;
  /** updatedAt ของตารางแต่ละฉบับตามที่ server เก็บ (ใช้ทำ optimistic concurrency) */
  private ttVersions = new Map<ID, string>();

  constructor(
    private readonly db: Firestore,
    private readonly schoolId: string,
    private readonly session: Session | null,
  ) {
    this.termId = emptyDataset(schoolId).term.id;
  }

  private get isAdmin() {
    return this.session?.role === "admin";
  }

  private requireAdmin() {
    if (!this.isAdmin) throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขข้อมูลได้");
  }

  private entityCol(kind: EntityKind, termId = this.termId) {
    return collection(this.db, fsPaths.entity(this.schoolId, termId, kind));
  }

  private async commit(ops: Op[]) {
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const op of ops.slice(i, i + BATCH_LIMIT)) {
        if (op.kind === "delete") batch.delete(op.ref);
        else if (op.merge) batch.set(op.ref, op.data, { merge: true });
        else batch.set(op.ref, op.data);
      }
      await batch.commit();
    }
  }

  // ---------------------------------------------------------------- load

  async load(): Promise<Snapshot> {
    if (!this.cache || Date.now() - this.fetchedAt > CACHE_TTL_MS) {
      try {
        this.cache = await this.fetchAll();
        this.fetchedAt = Date.now();
      } catch (e) {
        throw friendly(e);
      }
    }
    return structuredClone(this.cache);
  }

  private async fetchAll(): Promise<Snapshot> {
    const base = emptyDataset(this.schoolId);
    if (!this.session) return { dataset: base, timetables: [] };

    const schoolSnap = await getDoc(doc(this.db, fsPaths.school(this.schoolId)));
    if (!schoolSnap.exists()) {
      // ฐานข้อมูลยังว่าง: คืนชุดข้อมูลว่างที่ถูกต้อง (โครงสร้างเวลาเริ่มต้นจากข้อมูลจำลอง)
      // จะเขียนลงฐานข้อมูลเมื่อ admin บันทึกครั้งแรกหรือสั่ง "รีเซ็ตเป็นข้อมูลจำลอง" (replaceAll) เท่านั้น
      this.bootstrapped = false;
      return { dataset: base, timetables: [] };
    }
    this.bootstrapped = true;
    const school = schoolSnap.data() as SchoolDoc;
    const termId = school.activeTermId || base.term.id;
    this.termId = termId;

    const role = this.session.role;
    const studentsPromise: Promise<Dataset["students"]> =
      role === "admin"
        ? getDocs(collection(this.db, fsPaths.students(this.schoolId))).then((s) => s.docs.map((d) => withId(d.id, d.data())))
        : role === "student" && this.session.studentId
          ? getDoc(doc(this.db, fsPaths.students(this.schoolId), this.session.studentId)).then((d) =>
              d.exists() ? [withId(d.id, d.data())] : [],
            )
          : Promise.resolve([]);

    const ttCol = collection(this.db, fsPaths.timetables(this.schoolId, termId));
    const timetablesPromise =
      role === "admin" ? getDocs(ttCol) : getDocs(query(ttCol, where("status", "==", "published"), limit(1)));

    const [termSnap, timeSnap, students, ttSnap, ...entitySnaps] = await Promise.all([
      getDoc(doc(this.db, fsPaths.term(this.schoolId, termId))),
      getDoc(doc(this.db, fsPaths.time(this.schoolId, termId))),
      studentsPromise,
      timetablesPromise,
      ...TERM_ENTITY_KINDS.map((k) => getDocs(this.entityCol(k, termId))),
    ]);

    const term = termSnap.data() as TermDoc | undefined;
    const time = timeSnap.data() as TimeStructure | undefined;
    const lists = Object.fromEntries(
      TERM_ENTITY_KINDS.map((k, i) => [k, entitySnaps[i].docs.map((d) => withId(d.id, d.data()))]),
    ) as Pick<Dataset, (typeof TERM_ENTITY_KINDS)[number]>;

    const dataset: Dataset = {
      school: {
        id: this.schoolId,
        name: school.name ?? base.school.name,
        regularEndTime: school.regularEndTime ?? base.school.regularEndTime,
        signatories: school.signatories ?? [],
      },
      term: term ? { id: termId, year: term.year, term: term.term, status: term.status } : { ...base.term, id: termId },
      time: time ?? base.time,
      ...lists,
      students,
    };

    this.ttVersions.clear();
    const timetables: TimetableVersion[] = [];
    for (const d of ttSnap.docs) {
      const data = d.data() as TimetableDoc;
      try {
        timetables.push(timetableFromDoc(d.id, data));
        this.ttVersions.set(d.id, data.updatedAt);
      } catch (e) {
        console.warn(`[firestore] ข้ามตาราง ${d.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
    timetables.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return { dataset, timetables };
  }

  private invalidate() {
    this.cache = null;
  }

  /** สร้างเอกสาร school/term/time ครั้งแรก (เมื่อ admin เริ่มบันทึกข้อมูล) */
  private bootstrapOps(ds: Dataset): Op[] {
    return [
      { kind: "set", ref: doc(this.db, fsPaths.school(this.schoolId)), data: schoolToDoc(ds.school, ds.term.id), merge: true },
      { kind: "set", ref: doc(this.db, fsPaths.term(this.schoolId, ds.term.id)), data: termToDoc(ds.term), merge: true },
      { kind: "set", ref: doc(this.db, fsPaths.time(this.schoolId, ds.term.id)), data: ds.time as unknown as DocumentData },
    ];
  }

  // ---------------------------------------------------------------- master data

  async upsert<K extends EntityKind>(kind: K, items: EntityOf<K>[]): Promise<void> {
    this.requireAdmin();
    const snap = await this.load();
    const ops: Op[] = this.bootstrapped ? [] : this.bootstrapOps(snap.dataset);
    for (const item of items as unknown as { id: ID }[]) {
      ops.push({ kind: "set", ref: doc(this.entityCol(kind), item.id), data: stripId(item) });
    }
    try {
      await this.commit(ops);
    } catch (e) {
      throw friendly(e);
    }
    this.bootstrapped = true;
    if (this.cache) {
      const list = this.cache.dataset[kind] as unknown as { id: ID }[];
      const index = new Map(list.map((x, i) => [x.id, i]));
      for (const item of items as unknown as { id: ID }[]) {
        const i = index.get(item.id);
        if (i === undefined) list.push(structuredClone(item));
        else list[i] = structuredClone(item);
      }
    }
  }

  async remove(kind: EntityKind, ids: ID[]): Promise<void> {
    this.requireAdmin();
    await this.load();
    try {
      await this.commit(ids.map((id) => ({ kind: "delete" as const, ref: doc(this.entityCol(kind), id) })));
    } catch (e) {
      throw friendly(e);
    }
    if (this.cache) {
      const set = new Set(ids);
      const ds = this.cache.dataset as unknown as Record<EntityKind, { id: ID }[]>;
      ds[kind] = ds[kind].filter((x) => !set.has(x.id));
    }
  }

  async saveSettings(patch: SettingsPatch): Promise<void> {
    this.requireAdmin();
    const snap = await this.load();
    const next: Dataset = { ...snap.dataset, ...structuredClone(patch) };
    const termChanged = next.term.id !== this.termId;
    try {
      await this.commit(this.bootstrapOps(next));
    } catch (e) {
      throw friendly(e);
    }
    this.bootstrapped = true;
    if (termChanged) {
      // เปลี่ยนภาคเรียนปัจจุบัน → ข้อมูลหลักอยู่คนละ path ต้องโหลดใหม่
      this.termId = next.term.id;
      this.invalidate();
    } else if (this.cache) {
      this.cache.dataset = next;
    }
  }

  async replaceAll(dataset: Dataset, timetables: TimetableVersion[] = []): Promise<void> {
    this.requireAdmin();
    await this.load();
    const ops: Op[] = [];
    try {
      // ลบข้อมูลหลักเดิมของภาคเรียนปัจจุบัน + นักเรียน
      const kinds: EntityKind[] = [...TERM_ENTITY_KINDS, "students"];
      const existing = await Promise.all(kinds.map((k) => getDocs(this.entityCol(k))));
      const keep = new Set(
        kinds.flatMap((k) =>
          (dataset[k] as unknown as { id: ID }[]).map((x) => `${fsPaths.entity(this.schoolId, dataset.term.id, k)}/${x.id}`),
        ),
      );
      existing.forEach((s) => s.docs.forEach((d) => !keep.has(d.ref.path) && ops.push({ kind: "delete", ref: d.ref })));
      // เขียนชุดใหม่ (ภายใต้ term ของ dataset ใหม่)
      ops.push(...this.bootstrapOps(dataset));
      for (const kind of kinds) {
        for (const item of dataset[kind] as unknown as { id: ID }[]) {
          ops.push({
            kind: "set",
            ref: doc(this.db, fsPaths.entity(this.schoolId, dataset.term.id, kind), item.id),
            data: stripId(item),
          });
        }
      }
      await this.commit(ops);
    } catch (e) {
      throw friendly(e);
    }
    this.bootstrapped = true;
    this.termId = dataset.term.id;
    this.invalidate();
    // หมายเหตุ: ตารางเดิมใน Firestore ไม่ถูกลบอัตโนมัติ (client ลบเองไม่ได้ตาม rules) — ลบผ่านหน้าตาราง/API
    for (const tt of timetables) {
      if (tt.status === "draft") await this.saveTimetable(tt);
    }
  }

  // ---------------------------------------------------------------- timetables (ผ่าน server API)

  async saveTimetable(tt: TimetableVersion): Promise<void> {
    this.requireAdmin();
    const res = await callApi<{ id: string; updatedAt: string; metrics: { hard: number; soft: number } }>("/api/timetables", {
      method: "POST",
      body: JSON.stringify({ timetable: tt, expectedUpdatedAt: this.ttVersions.get(tt.id) ?? null }),
    });
    this.ttVersions.set(tt.id, res.updatedAt);
    if (this.cache) {
      const saved: TimetableVersion = {
        ...structuredClone(tt),
        updatedAt: res.updatedAt,
        metrics: { ...tt.metrics, hard: res.metrics.hard, soft: res.metrics.soft },
      };
      const list = this.cache.timetables;
      const i = list.findIndex((x) => x.id === tt.id);
      if (i >= 0) list[i] = saved;
      else list.unshift(saved);
    }
  }

  async deleteTimetable(id: ID): Promise<void> {
    this.requireAdmin();
    await callApi(`/api/timetables/${encodeURIComponent(id)}`, { method: "DELETE" });
    this.ttVersions.delete(id);
    if (this.cache) this.cache.timetables = this.cache.timetables.filter((t) => t.id !== id);
  }

  async publishTimetable(id: ID): Promise<void> {
    this.requireAdmin();
    await callApi(`/api/timetables/${encodeURIComponent(id)}/publish`, { method: "POST" });
    this.invalidate();
  }
}

export async function createFirestoreRepository(): Promise<Repository> {
  const session = await getCurrentSession();
  return new FirestoreRepository(getClientDb(), getSchoolId(), session);
}
