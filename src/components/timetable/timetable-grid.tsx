"use client";
/**
 * TimetableGridView — แสดง TimetableGrid ตามรูปแบบตารางสอนวิทยาลัย:
 * แถว = วัน, คอลัมน์ = เวลา/คาบ, คอลัมน์กิจกรรมหน้าเสาธงแนวตั้ง, คาบต่อเนื่องรวมเซลล์
 * จอเล็ก (<640px) แสดงเป็นการ์ดรายวันแทน (ยกเว้นโหมดแก้ไข)
 */
import { useState, type DragEvent } from "react";
import type { Violation } from "@/engine/types";
import type { CellItem, GridCell, GridRow, TimetableGrid } from "@/lib/timetable/viewmodel";
import type { SchoolInfo } from "@/shared/types";
import { cx } from "@/components/ui";
import { CellDetailsDialog } from "./cell-details-dialog";
import { GridHeader, SignatureRow } from "./grid-header";
import { periodNoLabel, periodRangeLabel, sameBlock, slotKey, type BlockRef, type TargetInfo } from "./utils";

export interface GridEditProps {
  selected: BlockRef | null;
  /** key = "day:period" ของคาบเริ่มต้นที่เป็นไปได้ (null = ยังไม่ได้เลือก block) */
  targets: Map<string, TargetInfo> | null;
  onSelect: (sel: BlockRef | null) => void;
  onTarget: (day: number, period: number) => void;
  /** แตะช่องที่วางไม่ได้ (แสดงเหตุผล เช่น toast) */
  onInvalid?: (reasons: string) => void;
}

export interface TimetableGridViewProps {
  grid: TimetableGrid;
  school?: SchoolInfo;
  violations?: Violation[];
  edit?: GridEditProps;
  showHeader?: boolean;
  /** แสดงแถวลงนาม (ค่าเริ่มต้น: เฉพาะตารางครู) */
  showSignatures?: boolean;
  className?: string;
}

const DRAG_MIME = "application/x-learning-table-block";

interface DisplayCell extends GridCell {
  /** ช่องย่อยที่แยกจากเซลล์รวม (โหมดเลือกปลายทาง) */
  continuation?: boolean;
}

function splitRow(row: GridRow): DisplayCell[] {
  const out: DisplayCell[] = [];
  for (const c of row.cells) {
    for (let i = 0; i < c.span; i++) out.push({ ...c, startPeriod: c.startPeriod + i, span: 1, continuation: i > 0 });
  }
  return out;
}

function firstLesson(cell: GridCell): CellItem | undefined {
  return cell.items.find((i) => i.kind === "lesson");
}

export function TimetableGridView({ grid, school, violations, edit, showHeader = true, showSignatures, className }: TimetableGridViewProps) {
  const [detail, setDetail] = useState<GridCell | null>(null);
  const signatures = showSignatures ?? grid.kind === "teacher";
  const targeting = Boolean(edit?.selected && edit.targets);

  return (
    <div className={cx("print-area min-w-0", className)}>
      {showHeader && <GridHeader grid={grid} school={school} />}
      <div className={cx(edit ? "block" : "hidden sm:block", "print:block")}>
        <GridTable grid={grid} edit={edit} targeting={targeting} onOpen={setDetail} />
      </div>
      {!edit && (
        <div className="sm:hidden print:hidden">
          <DayCards grid={grid} onOpen={setDetail} />
        </div>
      )}
      {signatures && school && <SignatureRow school={school} />}
      <CellDetailsDialog grid={grid} cell={detail} violations={violations} onClose={() => setDetail(null)} />
    </div>
  );
}

function GridTable({
  grid,
  edit,
  targeting,
  onOpen,
}: {
  grid: TimetableGrid;
  edit?: GridEditProps;
  targeting: boolean;
  onOpen: (c: GridCell) => void;
}) {
  const pre = grid.preActivity;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface print:overflow-visible print:rounded-none print:border-0">
      <table className="w-full min-w-[1080px] table-fixed border-collapse text-xs print:min-w-0 print:text-[6.5pt]">
        <caption className="sr-only">ตาราง {grid.title}</caption>
        <colgroup>
          <col className="w-[84px] print:w-[52px]" />
          {pre && <col className="w-[34px] print:w-[18px]" />}
          {grid.periods.map((p) => (
            <col key={p.no} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-page">
            <th scope="col" className="sticky left-0 z-10 border border-line bg-page px-1 py-1 font-semibold">
              เวลา
            </th>
            {pre && (
              <th scope="col" className="border border-line px-0.5 py-1 text-[10px] font-normal leading-tight print:text-[5.5pt]">
                {pre.start}
                <br />-<br />
                {pre.end}
              </th>
            )}
            {grid.periods.map((p) => (
              <th key={p.no} scope="col" className="border border-line px-0.5 py-1 font-normal leading-tight whitespace-nowrap">
                {p.start} - {p.end}
              </th>
            ))}
          </tr>
          <tr className="bg-page">
            <th scope="col" className="sticky left-0 z-10 border border-line bg-page px-1 py-1 font-semibold">
              วัน/คาบ
            </th>
            {pre && <th scope="col" className="border border-line" aria-label={pre.label} />}
            {grid.periods.map((p) => (
              <th key={p.no} scope="col" className="border border-line px-1 py-1 font-semibold">
                {p.isBreak ? (p.label ?? "พัก") : p.no}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, ri) => {
            const cells: DisplayCell[] = targeting ? splitRow(row) : row.cells;
            return (
              <tr key={row.day.index} className={cx(!row.day.active && "bg-page")}>
                <th
                  scope="row"
                  className={cx(
                    "sticky left-0 z-10 h-16 border border-line px-1 text-left font-semibold whitespace-nowrap print:h-[13mm]",
                    row.day.active ? "bg-surface" : "bg-page text-muted",
                  )}
                >
                  {row.day.label}
                </th>
                {pre && ri === 0 && (
                  <td rowSpan={grid.rows.length} className="bg-hatch border border-line p-0 text-center align-middle">
                    <span className="vertical-text inline-block font-semibold tracking-wide whitespace-nowrap">{pre.label}</span>
                  </td>
                )}
                {cells.map((cell) => (
                  <GridTd key={`${cell.day}-${cell.startPeriod}`} grid={grid} cell={cell} edit={edit} targeting={targeting} onOpen={onOpen} />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const STATE_CLASS: Record<GridCell["state"], string> = {
  empty: "bg-surface",
  lesson: "bg-surface",
  activity: "bg-hatch",
  break: "bg-hatch",
  inactive: "bg-page",
  unavailable: "bg-page text-muted bg-[repeating-linear-gradient(45deg,transparent_0_5px,rgba(0,0,0,0.05)_5px_6px)]",
};

function CellContent({ cell, compact }: { cell: DisplayCell; compact?: boolean }) {
  if (cell.continuation) return <span className="sr-only">ต่อเนื่อง</span>;
  if (cell.state === "unavailable") return <span className="text-[10px]">ไม่ว่าง</span>;
  if (cell.state === "break") return <span className="text-[10px] text-muted">พัก</span>;
  if (cell.items.length === 0) return null;
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 leading-tight">
      {cell.items.map((it, i) => (
        <div key={i} className={cx("min-w-0 max-w-full", i > 0 && "border-t border-danger/40 pt-0.5")}>
          {it.lines.map((ln, li) =>
            ln ? (
              <div
                key={li}
                className={cx(
                  "truncate",
                  li === 0 ? "font-semibold" : "text-[10px] print:text-[5.5pt]",
                  compact && li > 0 && "hidden",
                )}
                title={ln}
              >
                {ln}
              </div>
            ) : null,
          )}
        </div>
      ))}
      {cell.conflict && <div className="text-[10px] font-semibold text-danger">⚠ ชน</div>}
    </div>
  );
}

function cellAria(grid: TimetableGrid, cell: GridCell): string {
  const day = grid.rows.find((r) => r.day.index === cell.day)?.day.label ?? "";
  const what = cell.items.map((i) => `${i.code} ${i.name} ${i.roomLabel} ${i.groupLabel}`).join(" และ ");
  return `${day} ${periodNoLabel(cell.startPeriod, cell.span)} ${periodRangeLabel(grid, cell.startPeriod, cell.span)} ${what || "ว่าง"}${cell.conflict ? " มีข้อขัดแย้ง" : ""}`;
}

function GridTd({
  grid,
  cell,
  edit,
  targeting,
  onOpen,
}: {
  grid: TimetableGrid;
  cell: DisplayCell;
  edit?: GridEditProps;
  targeting: boolean;
  onOpen: (c: GridCell) => void;
}) {
  const hasItems = cell.items.length > 0;
  const lesson = firstLesson(cell);
  const isSelected = Boolean(edit && cell.items.some((it) => sameBlock(edit.selected, it)));
  const target = targeting ? edit?.targets?.get(slotKey(cell.day, cell.startPeriod)) : undefined;
  const tdBase = cx(
    "relative h-16 border border-line p-0 text-center align-middle print:h-[13mm]",
    STATE_CLASS[cell.state],
    cell.conflict && "bg-danger-soft outline outline-2 -outline-offset-2 outline-danger",
    isSelected && "outline outline-2 -outline-offset-2 outline-accent",
    target?.ok && "bg-accent-soft",
  );

  // --- โหมดเลือกปลายทาง ---
  if (edit && targeting) {
    const onDragOver = (e: DragEvent) => {
      if (target?.ok) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (target?.ok) edit.onTarget(cell.day, cell.startPeriod);
    };
    if (target?.ok) {
      return (
        <td className={tdBase} onDragOver={onDragOver} onDrop={onDrop}>
          <button
            type="button"
            onClick={() => edit.onTarget(cell.day, cell.startPeriod)}
            className="flex h-full w-full flex-col items-center justify-center p-0.5 ring-inset hover:ring-2 hover:ring-accent"
            aria-label={`ย้ายมาที่ ${cellAria(grid, cell)}`}
            title="วางที่นี่ได้"
          >
            {hasItems ? <CellContent cell={cell} compact /> : <span className="text-[10px] font-semibold text-accent">วางได้</span>}
          </button>
        </td>
      );
    }
    if (isSelected && !cell.continuation) {
      return (
        <td className={tdBase}>
          <button type="button" onClick={() => edit.onSelect(null)} className="h-full w-full p-0.5" aria-label="ยกเลิกการเลือกคาบนี้">
            <CellContent cell={cell} compact />
          </button>
        </td>
      );
    }
    const reasons = target?.reasons.length ? target.reasons.join(" / ") : "วางที่นี่ไม่ได้";
    const activeSlot = cell.state === "empty" || cell.state === "lesson" || cell.state === "unavailable";
    return (
      <td className={cx(tdBase, activeSlot && "cursor-not-allowed")} title={activeSlot ? reasons : undefined}>
        {activeSlot ? (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center p-0.5 opacity-70"
            aria-label={`วางไม่ได้: ${reasons}`}
            onClick={() => edit.onInvalid?.(reasons)}
            aria-disabled="true"
          >
            <CellContent cell={cell} compact />
          </button>
        ) : (
          <CellContent cell={cell} compact />
        )}
      </td>
    );
  }

  // --- โหมดแก้ไข: เลือก block ---
  if (edit && lesson && lesson.assignmentId !== undefined && lesson.block !== undefined) {
    const sel: BlockRef = { assignmentId: lesson.assignmentId, block: lesson.block };
    return (
      <td colSpan={cell.span} className={tdBase}>
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, `${sel.assignmentId}:${sel.block}`);
            e.dataTransfer.effectAllowed = "move";
            // เลื่อนการเปลี่ยน state ไปเฟรมถัดไป เพื่อให้เบราว์เซอร์จับภาพลากก่อนตารางแยกช่อง
            requestAnimationFrame(() => edit.onSelect(sel));
          }}
          onClick={() => edit.onSelect(isSelected ? null : sel)}
          className="flex h-full w-full cursor-grab flex-col items-center justify-center p-0.5 hover:bg-accent-soft"
          aria-pressed={isSelected}
          aria-label={`เลือกเพื่อย้าย: ${cellAria(grid, cell)}`}
        >
          <CellContent cell={cell} />
        </button>
      </td>
    );
  }

  // --- โหมดดู ---
  if (hasItems) {
    return (
      <td colSpan={cell.span} className={tdBase}>
        <button
          type="button"
          onClick={() => onOpen(cell)}
          className="flex h-full w-full flex-col items-center justify-center p-0.5 hover:bg-accent-soft/60 print:p-0"
          aria-label={cellAria(grid, cell)}
        >
          <CellContent cell={cell} />
        </button>
      </td>
    );
  }
  return (
    <td colSpan={cell.span} className={tdBase}>
      <CellContent cell={cell} />
    </td>
  );
}

/** มุมมองการ์ดรายวัน (สมาร์ตโฟน) */
function DayCards({ grid, onOpen }: { grid: TimetableGrid; onOpen: (c: GridCell) => void }) {
  const activeRows = grid.rows.filter((r) => r.day.active || r.cells.some((c) => c.items.length > 0));
  const [day, setDay] = useState<number>(activeRows[0]?.day.index ?? 0);
  const row = grid.rows.find((r) => r.day.index === day) ?? activeRows[0];
  const lessons = row ? row.cells.filter((c) => c.items.length > 0) : [];
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div role="tablist" aria-label="เลือกวัน" className="flex gap-1 overflow-x-auto border-b border-line p-1">
        {grid.rows.map((r) => (
          <button
            key={r.day.index}
            role="tab"
            type="button"
            aria-selected={r.day.index === row?.day.index}
            onClick={() => setDay(r.day.index)}
            className={cx(
              "min-w-11 rounded-md px-2.5 py-1.5 text-sm",
              r.day.index === row?.day.index ? "bg-accent text-white" : r.day.active ? "text-ink hover:bg-page" : "text-muted",
            )}
          >
            {r.day.short}
          </button>
        ))}
      </div>
      <div className="p-3">
        <h3 className="mb-2 font-semibold">{row?.day.label}</h3>
        {grid.preActivity && row?.day.active && (
          <div className="bg-hatch mb-2 rounded-md border border-line px-3 py-2 text-sm">
            <span className="text-muted">
              {grid.preActivity.start} - {grid.preActivity.end}
            </span>{" "}
            {grid.preActivity.label}
          </div>
        )}
        {lessons.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{row?.day.active ? "ไม่มีคาบเรียน" : "ไม่เปิดสอน"}</p>
        ) : (
          <ul className="space-y-2">
            {lessons.map((c) => (
              <li key={c.startPeriod}>
                <button
                  type="button"
                  onClick={() => onOpen(c)}
                  className={cx(
                    "flex w-full gap-3 rounded-md border px-3 py-2 text-left",
                    c.conflict ? "border-danger bg-danger-soft" : "border-line",
                    c.state === "activity" && "bg-hatch",
                  )}
                  aria-label={cellAria(grid, c)}
                >
                  <div className="w-24 shrink-0 text-xs text-muted">
                    <div className="font-semibold text-ink">{periodNoLabel(c.startPeriod, c.span)}</div>
                    {periodRangeLabel(grid, c.startPeriod, c.span)}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    {c.items.map((it, i) => (
                      <div key={i} className="min-w-0">
                        <div className="font-semibold">
                          {it.code} <span className="font-normal">{it.name}</span>
                        </div>
                        <div className="text-xs text-muted">{it.lines.slice(1).filter(Boolean).join(" · ")}</div>
                      </div>
                    ))}
                    {c.conflict && <div className="text-xs font-semibold text-danger">⚠ มีข้อขัดแย้ง</div>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
