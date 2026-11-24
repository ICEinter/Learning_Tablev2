"use client";
/**
 * ตารางฉบับเผยแพร่ของผู้ใช้ (ครู/นักเรียน) — ไม่แสดงร่างเด็ดขาด
 */
import { useMemo } from "react";
import { useData } from "@/lib/store/data-context";
import { gridFileBase } from "@/lib/timetable/overview";
import { buildGrid, type ViewKind } from "@/lib/timetable/viewmodel";
import { Card, EmptyState } from "@/components/ui";
import { TimetableExportBar } from "./export-bar";
import { GridSummary } from "./grid-summary";
import { TimetableGridView } from "./timetable-grid";
import { formatDateTime } from "./utils";

export function PublishedTimetable({ kind, entityId, showSummary = true }: { kind: ViewKind; entityId: string | undefined; showSummary?: boolean }) {
  const { dataset: ds, published } = useData();
  const placements = published?.status === "published" ? published.placements : undefined;
  const exists = useMemo(() => {
    if (!entityId) return false;
    if (kind === "teacher") return ds.teachers.some((t) => t.id === entityId);
    if (kind === "student") return ds.students.some((s) => s.id === entityId);
    if (kind === "group") return ds.groups.some((g) => g.id === entityId);
    return true;
  }, [ds, kind, entityId]);
  const grid = useMemo(
    () => (placements && entityId && exists ? buildGrid(ds, placements, kind, entityId) : null),
    [ds, placements, kind, entityId, exists],
  );

  if (!published || !placements) {
    return <EmptyState title="ยังไม่มีตารางที่เผยแพร่">เมื่อฝ่ายวิชาการเผยแพร่ตารางแล้ว ตารางของคุณจะแสดงที่นี่</EmptyState>;
  }
  if (!grid) {
    return <EmptyState title="ไม่พบข้อมูลของบัญชีนี้">บัญชียังไม่ได้ผูกกับข้อมูลครู/นักเรียน โปรดติดต่อผู้ดูแลระบบ</EmptyState>;
  }
  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          ฉบับเผยแพร่: {published.label} · เผยแพร่เมื่อ {formatDateTime(published.publishedAt ?? published.updatedAt)}
        </p>
        <TimetableExportBar school={ds.school} fileBase={gridFileBase(ds, kind, entityId ?? null)} current={() => grid} />
      </div>
      {showSummary && <GridSummary stats={grid.stats} className="no-print" />}
      <Card>
        <TimetableGridView grid={grid} school={ds.school} />
      </Card>
    </div>
  );
}
