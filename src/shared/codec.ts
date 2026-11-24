/**
 * Codec ตารางสอนแบบ packed (DEVELOPMENT_PLAN 4.4)
 * เก็บตาราง 1 เวอร์ชันใน 1 Firestore document เพื่อให้โหลด/บันทึก = 1 read / 1 write
 *
 * รูปแบบ entry: "aIdx.block.day.period.rIdx;" ต่อกันเป็นสตริงเดียว
 *  - aIdx = ตำแหน่งของ assignmentId ใน dict.a
 *  - rIdx = ตำแหน่งของ roomId ใน dict.r
 * ไฟล์นี้ต้องไม่ import Firebase/UI (ใช้ได้ทั้ง client, server และ engine test)
 */
import type { Dataset, EntityKind, ID, Placement, TimetableStatus, TimetableVersion } from "./types";

export interface PackedDict {
  a: ID[];
  r: ID[];
}

export interface PackedTimetable {
  dict: PackedDict;
  entries: string;
}

export function encodePlacements(placements: Placement[]): PackedTimetable {
  const a: ID[] = [];
  const r: ID[] = [];
  const aIdx = new Map<ID, number>();
  const rIdx = new Map<ID, number>();
  const idx = (map: Map<ID, number>, list: ID[], id: ID) => {
    let i = map.get(id);
    if (i === undefined) {
      i = list.length;
      list.push(id);
      map.set(id, i);
    }
    return i;
  };
  const parts: string[] = [];
  for (const p of placements) {
    for (const n of [p.block, p.day, p.period]) {
      if (!Number.isInteger(n) || n < 0) throw new Error(`ข้อมูลตารางไม่ถูกต้อง: ค่าตัวเลข ${n} ไม่ใช่จำนวนเต็มบวก`);
    }
    parts.push(`${idx(aIdx, a, p.assignmentId)}.${p.block}.${p.day}.${p.period}.${idx(rIdx, r, p.roomId)};`);
  }
  return { dict: { a, r }, entries: parts.join("") };
}

export function decodePlacements(packed: PackedTimetable): Placement[] {
  const { dict, entries } = packed;
  if (!dict || !Array.isArray(dict.a) || !Array.isArray(dict.r) || typeof entries !== "string") {
    throw new Error("ข้อมูลตารางเสียหาย: รูปแบบ dict/entries ไม่ถูกต้อง");
  }
  const out: Placement[] = [];
  for (const raw of entries.split(";")) {
    if (!raw) continue;
    const nums = raw.split(".").map((s) => (/^\d+$/.test(s) ? Number(s) : NaN));
    if (nums.length !== 5 || nums.some((n) => Number.isNaN(n))) {
      throw new Error(`ข้อมูลตารางเสียหาย: entry "${raw}" ไม่ถูกต้อง`);
    }
    const [ai, block, day, period, ri] = nums;
    const assignmentId = dict.a[ai];
    const roomId = dict.r[ri];
    if (assignmentId === undefined || roomId === undefined) {
      throw new Error(`ข้อมูลตารางเสียหาย: entry "${raw}" อ้างอิง dictionary เกินขอบเขต`);
    }
    out.push({ assignmentId, block, day, period, roomId });
  }
  return out;
}

/** ขนาดโดยประมาณ (ไบต์ UTF-8) ของ packed doc — ใช้ประเมินเทียบเพดาน 1 MiB ของ Firestore */
export function packedSizeBytes(packed: PackedTimetable): number {
  return new TextEncoder().encode(JSON.stringify(packed)).length;
}

/* ------------------------------------------------------------------ */
/* การแมปเอกสาร Firestore ⇄ domain types (pure — ใช้ทั้ง client SDK และ Admin SDK) */
/* ------------------------------------------------------------------ */

/** collection ของข้อมูลหลักที่อยู่ใต้ภาคเรียน (students อยู่ระดับสถานศึกษา) */
export const TERM_ENTITY_KINDS = ["courses", "teachers", "rooms", "groups", "assignments", "activities"] as const;
export type TermEntityKind = (typeof TERM_ENTITY_KINDS)[number];

export const fsPaths = {
  users: "users",
  school: (s: string) => `schools/${s}`,
  students: (s: string) => `schools/${s}/students`,
  auditLog: (s: string) => `schools/${s}/auditLog`,
  term: (s: string, t: string) => `schools/${s}/terms/${t}`,
  time: (s: string, t: string) => `schools/${s}/terms/${t}/config/time`,
  entity: (s: string, t: string, kind: EntityKind) =>
    kind === "students" ? `schools/${s}/students` : `schools/${s}/terms/${t}/${kind}`,
  timetables: (s: string, t: string) => `schools/${s}/terms/${t}/timetables`,
  views: (s: string, t: string, v: string) => `schools/${s}/terms/${t}/timetables/${v}/views`,
};

/** ฟิลด์ใน schools/{schoolId} */
export interface SchoolDoc {
  name: string;
  regularEndTime: string;
  signatories: { name: string; title: string }[];
  timezone?: string;
  activeTermId?: string;
}

/** ฟิลด์ใน schools/{s}/terms/{t} */
export interface TermDoc {
  year: string;
  term: string;
  status: "setup" | "active" | "archived";
  publishedVersionId?: string;
}

/** เอกสารตาราง 1 เวอร์ชัน (เขียนโดย server เท่านั้น) */
export interface TimetableDoc extends PackedTimetable {
  termId: string;
  label: string;
  status: TimetableStatus;
  entryCount: number;
  hardViolations: number;
  softScore: number;
  metrics: { hard: number; soft: number; elapsedMs?: number };
  source: { algorithm: string; seed?: number; jobId?: string };
  note?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  publishedAt?: string;
  publishedBy?: string;
}

export function stripId<T extends { id: string }>(item: T): Omit<T, "id"> {
  const { id: _id, ...rest } = item;
  void _id;
  return rest;
}

export function withId<T>(id: string, data: unknown): T {
  return { ...(data as object), id } as T;
}

export function schoolToDoc(school: Dataset["school"], activeTermId?: string): SchoolDoc {
  return {
    name: school.name,
    regularEndTime: school.regularEndTime,
    signatories: school.signatories,
    timezone: "Asia/Bangkok",
    ...(activeTermId ? { activeTermId } : {}),
  };
}

export function termToDoc(term: Dataset["term"]): TermDoc {
  return { year: term.year, term: term.term, status: term.status };
}

export function timetableToDoc(
  tt: TimetableVersion,
  metrics: { hard: number; soft: number; elapsedMs?: number },
  extra: { updatedAt: string; createdBy?: string },
): TimetableDoc {
  const packed = encodePlacements(tt.placements);
  return {
    ...packed,
    termId: tt.termId,
    label: tt.label,
    status: tt.status,
    entryCount: tt.placements.length,
    hardViolations: metrics.hard,
    softScore: metrics.soft,
    metrics,
    source: tt.source,
    ...(tt.note ? { note: tt.note } : {}),
    createdAt: tt.createdAt,
    updatedAt: extra.updatedAt,
    ...(extra.createdBy ? { createdBy: extra.createdBy } : {}),
    ...(tt.publishedAt ? { publishedAt: tt.publishedAt } : {}),
  };
}

export function timetableFromDoc(id: string, d: TimetableDoc): TimetableVersion {
  return {
    id,
    termId: d.termId,
    label: d.label,
    status: d.status,
    placements: decodePlacements(d),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    publishedAt: d.publishedAt,
    source: d.source ?? { algorithm: "unknown" },
    metrics: d.metrics ?? { hard: d.hardViolations, soft: d.softScore },
    note: d.note,
  };
}
