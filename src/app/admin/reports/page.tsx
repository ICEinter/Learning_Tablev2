"use client";
/**
 * /admin/reports — รายงาน ภาระสอน / คาบว่าง / การใช้ห้อง / ข้อขัดแย้ง / ตารางรวม + พรีวิว + Export
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { validate } from "@/engine";
import {
  conflictReport,
  freePeriodsReport,
  placementListReport,
  roomUtilizationReport,
  teacherLoadReport,
} from "@/lib/reports/reports";
import type { ReportTable } from "@/lib/reports/types";
import { useData } from "@/lib/store/data-context";
import { effectiveBlocks, termLabel } from "@/shared/slots";
import type { Dataset, Placement } from "@/shared/types";
import { Card, EmptyState, Field, PageHeader, Select, Stat, Tabs } from "@/components/ui";
import { ReportExportBar } from "@/components/reports/report-export-bar";
import { ReportTableView, useReportView } from "@/components/reports/report-table";
import { STATUS_TEXT } from "@/components/timetable/utils";

type Tab = "load" | "free" | "rooms" | "conflicts" | "overview";
const TABS: { value: Tab; label: string }[] = [
  { value: "load", label: "ภาระสอน" },
  { value: "free", label: "คาบว่าง" },
  { value: "rooms", label: "การใช้ห้อง" },
  { value: "conflicts", label: "ข้อขัดแย้ง" },
  { value: "overview", label: "ตารางรวม" },
];

function quickStats(ds: Dataset, placements: Placement[]) {
  const asg = new Map(ds.assignments.map((a) => [a.id, a]));
  const course = new Map(ds.courses.map((c) => [c.id, c]));
  const perTeacher = new Map<string, number>();
  const perRoom = new Map<string, number>();
  for (const p of placements) {
    const a = asg.get(p.assignmentId);
    if (!a) continue;
    const len = effectiveBlocks(a, course.get(a.courseId))[p.block] ?? 1;
    perTeacher.set(a.teacherId, (perTeacher.get(a.teacherId) ?? 0) + len);
    perRoom.set(p.roomId, (perRoom.get(p.roomId) ?? 0) + len);
  }
  const activeDays = ds.time.days.filter((d) => d.active).length;
  const teachPeriods = ds.time.periods.filter((p) => !p.isBreak).length;
  const capacity = activeDays * teachPeriods;
  const loads = ds.teachers.map((t) => perTeacher.get(t.id) ?? 0);
  const avg = loads.length ? loads.reduce((s, n) => s + n, 0) / loads.length : 0;
  const busyRooms = capacity ? ds.rooms.filter((r) => (perRoom.get(r.id) ?? 0) / capacity > 0.8).length : 0;
  return { avg: Math.round(avg * 10) / 10, max: loads.length ? Math.max(...loads) : 0, busyRooms, capacity };
}

export default function ReportsPage() {
  const { dataset: ds, timetables, published } = useData();
  const defaultId = useMemo(() => {
    if (published) return published.id;
    const drafts = timetables.filter((t) => t.status === "draft").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return drafts[0]?.id ?? timetables[0]?.id ?? "";
  }, [published, timetables]);
  const [picked, setPicked] = useState<string>("");
  const ttId = picked && timetables.some((t) => t.id === picked) ? picked : defaultId;
  const tt = timetables.find((t) => t.id === ttId);
  const [tab, setTab] = useState<Tab>("load");

  const placements = tt?.placements;
  const validation = useMemo(() => (placements ? validate(ds, placements) : null), [ds, placements]);
  const reports = useMemo<Record<Tab, ReportTable> | null>(() => {
    if (!placements || !validation) return null;
    return {
      load: teacherLoadReport(ds, placements),
      free: freePeriodsReport(ds, placements),
      rooms: roomUtilizationReport(ds, placements),
      conflicts: conflictReport(ds, validation.violations),
      overview: placementListReport(ds, placements),
    };
  }, [ds, placements, validation]);
  const stats = useMemo(() => (placements ? quickStats(ds, placements) : null), [ds, placements]);

  if (timetables.length === 0) {
    return (
      <div>
        <PageHeader title="รายงาน" />
        <EmptyState title="ยังไม่มีตาราง">
          <Link href="/admin/solve" className="text-accent underline">
            ไปหน้าจัดตารางอัตโนมัติ
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="รายงาน" description={`ภาคเรียน ${termLabel(ds)} · ${ds.school.name}`} />

      <div className="no-print max-w-xl">
        <Field label="ตารางที่ใช้ทำรายงาน">
          {(id) => (
            <Select id={id} value={ttId} onChange={(e) => setPicked(e.target.value)}>
              {timetables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({STATUS_TEXT[t.status]})
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {stats && validation && (
        <div className="no-print grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="ภาระสอนเฉลี่ย/ครู" value={`${stats.avg}`} hint="คาบต่อสัปดาห์" />
          <Stat label="ภาระสอนสูงสุด" value={`${stats.max}`} hint="คาบต่อสัปดาห์" />
          <Stat label="ห้องที่ใช้เกิน 80%" value={stats.busyRooms} tone={stats.busyRooms ? "warn" : "neutral"} hint={`จาก ${ds.rooms.length} ห้อง (${stats.capacity} คาบ/สัปดาห์)`} />
          <Stat label="ข้อขัดแย้ง Hard" value={validation.score.hard} tone={validation.score.hard ? "danger" : "ok"} hint={`Soft ${Math.round(validation.score.soft * 10) / 10}`} />
        </div>
      )}

      <Tabs<Tab> value={tab} onChange={setTab} items={TABS} />

      {reports && tt && (
        <Card>
          <ReportPanel
            key={`${tab}-${tt.id}`}
            table={reports[tab]}
            all={Object.values(reports)}
            ds={ds}
            fileBase={`รายงาน-${TABS.find((t) => t.value === tab)?.label}-${termLabel(ds)}`}
          />
        </Card>
      )}
    </div>
  );
}

function ReportPanel({ table, all, ds, fileBase }: { table: ReportTable; all: ReportTable[]; ds: Dataset; fileBase: string }) {
  const view = useReportView(table);
  return (
    <div className="space-y-3">
      <ReportExportBar
        school={ds.school}
        termLabel={termLabel(ds)}
        fileBase={fileBase}
        current={() => (view.table ? [view.table] : [])}
        all={() => all}
      />
      <ReportTableView view={view} />
    </div>
  );
}
