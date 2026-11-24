"use client";
/**
 * ข้อมูลอ้างอิงที่คำนวณครั้งเดียวต่อชุดข้อมูล (map ตาม id, ภาระสอน, ปัญหาจาก checkDataset)
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useData } from "@/lib/store/data-context";
import { checkDataset, type DataIssue } from "@/shared/integrity";
import { effectivePeriods, teacherName } from "@/shared/slots";
import type { Assignment, Course, Dataset, EntityKind, Room, StudentGroup, Teacher } from "@/shared/types";

export interface Lookups {
  courseById: Map<string, Course>;
  teacherById: Map<string, Teacher>;
  roomById: Map<string, Room>;
  groupById: Map<string, StudentGroup>;
  assignmentById: Map<string, Assignment>;
  /** คาบสอนต่อสัปดาห์ของครู (จากการมอบหมายสอน) */
  teacherLoad: Map<string, number>;
  /** คาบเรียนต่อสัปดาห์ของกลุ่ม */
  groupPeriods: Map<string, number>;
  issues: DataIssue[];
  issuesFor: (kind: EntityKind, id: string) => DataIssue[];
  departments: string[];
  equipment: string[];
  assignmentLabel: (a: Assignment) => string;
  groupSize: (groupIds: string[]) => number;
}

const LookupsContext = createContext<Lookups | null>(null);

function uniqSorted(xs: (string | undefined)[]): string[] {
  return [...new Set(xs.filter((x): x is string => Boolean(x && x.trim())))].sort((a, b) => a.localeCompare(b, "th"));
}

export function buildLookups(ds: Dataset): Lookups {
  const courseById = new Map(ds.courses.map((c) => [c.id, c]));
  const teacherById = new Map(ds.teachers.map((t) => [t.id, t]));
  const roomById = new Map(ds.rooms.map((r) => [r.id, r]));
  const groupById = new Map(ds.groups.map((g) => [g.id, g]));
  const assignmentById = new Map(ds.assignments.map((a) => [a.id, a]));
  const teacherLoad = new Map<string, number>();
  const groupPeriods = new Map<string, number>();
  for (const a of ds.assignments) {
    const n = effectivePeriods(a, courseById.get(a.courseId));
    teacherLoad.set(a.teacherId, (teacherLoad.get(a.teacherId) ?? 0) + n);
    for (const g of a.groupIds) groupPeriods.set(g, (groupPeriods.get(g) ?? 0) + n);
  }
  const issues = checkDataset(ds);
  const byKey = new Map<string, DataIssue[]>();
  for (const i of issues) {
    if (!i.id) continue;
    const k = `${i.entity}:${i.id}`;
    const list = byKey.get(k);
    if (list) list.push(i);
    else byKey.set(k, [i]);
  }
  return {
    courseById,
    teacherById,
    roomById,
    groupById,
    assignmentById,
    teacherLoad,
    groupPeriods,
    issues,
    issuesFor: (kind, id) => byKey.get(`${kind}:${id}`) ?? [],
    departments: uniqSorted([...ds.courses.map((c) => c.department), ...ds.teachers.map((t) => t.department), ...ds.groups.map((g) => g.department)]),
    equipment: uniqSorted([...ds.rooms.flatMap((r) => r.equipment), ...ds.courses.flatMap((c) => c.requiredEquipment)]),
    assignmentLabel: (a) => {
      const c = courseById.get(a.courseId);
      const t = teacherById.get(a.teacherId);
      const groups = a.groupIds.map((g) => groupById.get(g)?.code ?? g).join(", ");
      return `${c?.code ?? a.courseId} — ${groups || "-"} — ${t ? teacherName(t) : a.teacherId}`;
    },
    groupSize: (ids) => ids.reduce((s, g) => s + (groupById.get(g)?.size ?? 0), 0),
  };
}

export function LookupsProvider({ children }: { children: ReactNode }) {
  const { dataset } = useData();
  const value = useMemo(() => buildLookups(dataset), [dataset]);
  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>;
}

export function useLookups(): Lookups {
  const ctx = useContext(LookupsContext);
  if (!ctx) throw new Error("useLookups ต้องอยู่ภายใน <LookupsProvider>");
  return ctx;
}

/** ห้องที่ตรงเงื่อนไขรายวิชา (ประเภท/ความจุ/อุปกรณ์) */
export function fittingRooms(rooms: Room[], course: Course | undefined, size: number): Room[] {
  if (!course) return [];
  return rooms.filter((r) => r.type === course.roomType && r.capacity >= size && course.requiredEquipment.every((e) => r.equipment.includes(e)));
}
