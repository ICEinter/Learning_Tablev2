"use client";
import type { Violation } from "@/engine/types";
import type { GridCell, TimetableGrid } from "@/lib/timetable/viewmodel";
import { Badge, Button, Dialog } from "@/components/ui";
import { periodNoLabel, periodRangeLabel, violationsForCell } from "./utils";

const STATE_LABEL: Record<GridCell["state"], string> = {
  empty: "ว่าง",
  lesson: "คาบสอน",
  activity: "กิจกรรม",
  break: "พัก",
  inactive: "ไม่เปิดสอน",
  unavailable: "ไม่ว่าง",
};

export function CellDetailsDialog({
  grid,
  cell,
  violations,
  onClose,
}: {
  grid: TimetableGrid;
  cell: GridCell | null;
  violations?: Violation[];
  onClose: () => void;
}) {
  const open = cell !== null;
  const dayLabel = cell ? (grid.rows.find((r) => r.day.index === cell.day)?.day.label ?? "") : "";
  const touching = cell ? violationsForCell(cell, violations) : [];
  return (
    <Dialog open={open} onClose={onClose} title="รายละเอียดคาบ" footer={<Button onClick={onClose}>ปิด</Button>}>
      {cell && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={cell.state === "lesson" ? "accent" : "neutral"}>{STATE_LABEL[cell.state]}</Badge>
            <span>
              {dayLabel} · {periodNoLabel(cell.startPeriod, cell.span)} · {periodRangeLabel(grid, cell.startPeriod, cell.span)} น.
            </span>
            {cell.conflict && <Badge tone="danger">⚠ มีข้อขัดแย้ง</Badge>}
          </div>
          {cell.items.length === 0 && <p className="text-muted">ไม่มีคาบเรียนในช่วงเวลานี้</p>}
          {cell.items.map((it, i) => (
            <dl
              key={`${it.assignmentId ?? it.activityId}-${it.block ?? 0}-${i}`}
              className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 rounded-md border border-line p-3"
            >
              <dt className="text-muted">{it.kind === "lesson" ? "รายวิชา" : "กิจกรรม"}</dt>
              <dd>
                <span className="font-semibold">{it.code}</span> {it.name}
              </dd>
              {it.teacherLabel && (
                <>
                  <dt className="text-muted">ผู้สอน</dt>
                  <dd>{it.teacherLabel}</dd>
                </>
              )}
              <dt className="text-muted">ห้อง</dt>
              <dd>{it.roomLabel || "-"}</dd>
              <dt className="text-muted">กลุ่มเรียน</dt>
              <dd>{it.groupLabel || "-"}</dd>
              <dt className="text-muted">ความยาว</dt>
              <dd>
                {cell.span} คาบต่อเนื่อง
                {it.kind === "lesson" && it.block !== undefined && <span className="text-muted"> (ช่วงที่ {it.block + 1})</span>}
              </dd>
            </dl>
          ))}
          {touching.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">ข้อขัดแย้งที่เกี่ยวข้อง</h3>
              <ul className="space-y-1">
                {touching.map((v, i) => (
                  <li key={i} className="flex gap-2">
                    <Badge tone={v.severity === "hard" ? "danger" : "warn"}>{v.severity === "hard" ? "Hard" : "Soft"}</Badge>
                    <span>{v.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
