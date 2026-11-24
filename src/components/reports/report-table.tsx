"use client";
/**
 * ReportTableView — แสดง ReportTable แบบทั่วไป: เรียงคอลัมน์, กรองข้อความ, จัดตำแหน่งตัวเลข, หมายเหตุท้ายตาราง
 * สถานะการเรียง/กรองอยู่ใน useReportView เพื่อให้หน้าเพจนำแถวที่กรองแล้วไป export ได้
 */
import { useCallback, useMemo, useState } from "react";
import type { ReportColumn, ReportTable } from "@/lib/reports/types";
import { Input, cx } from "@/components/ui";

export interface ReportView {
  sortKey: string | null;
  dir: 1 | -1;
  text: string;
  setText: (t: string) => void;
  toggleSort: (key: string) => void;
  /** ตารางที่ผ่านการกรอง/เรียงแล้ว (ใช้ export) */
  table: ReportTable | null;
}

function cmp(a: string | number | undefined, b: string | number | undefined): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a);
  const nb = Number(b);
  if (a !== "" && b !== "" && a !== undefined && b !== undefined && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""), "th");
}

export function applyReportView(table: ReportTable, sortKey: string | null, dir: 1 | -1, text: string): ReportTable {
  const q = text.trim().toLowerCase();
  let rows = q ? table.rows.filter((r) => table.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) : table.rows;
  if (sortKey) rows = [...rows].sort((x, y) => cmp(x[sortKey], y[sortKey]) * dir);
  const filtered = rows.length !== table.rows.length;
  return {
    ...table,
    rows,
    footnote: [table.footnote, filtered ? `กรองด้วย "${text.trim()}" — แสดง ${rows.length} จาก ${table.rows.length} แถว` : ""].filter(Boolean).join(" · ") || undefined,
  };
}

export function useReportView(table: ReportTable | null): ReportView {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [text, setText] = useState("");
  const toggleSort = useCallback(
    (key: string) => {
      if (sortKey === key) setDir((d) => (d === 1 ? -1 : 1));
      else {
        setSortKey(key);
        setDir(1);
      }
    },
    [sortKey],
  );
  const view = useMemo(() => (table ? applyReportView(table, sortKey, dir, text) : null), [table, sortKey, dir, text]);
  return { sortKey, dir, text, setText, toggleSort, table: view };
}

function alignOf(c: ReportColumn): string {
  const a = c.align ?? (c.numeric ? "right" : "left");
  return a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
}

export function ReportTableView({
  view,
  showFilter = true,
  maxRows = 1000,
}: {
  view: ReportView;
  showFilter?: boolean;
  maxRows?: number;
}) {
  const t = view.table;
  if (!t) return null;
  return (
    <div className="print-area min-w-0 space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{t.title}</h2>
          {t.subtitle && <p className="text-sm text-muted">{t.subtitle}</p>}
        </div>
        {showFilter && (
          <Input
            className="no-print w-full sm:w-64"
            aria-label="กรองข้อมูลในรายงาน"
            placeholder="กรองข้อความ…"
            value={view.text}
            onChange={(e) => view.setText(e.target.value)}
          />
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface print:overflow-visible print:border-0">
        <table className="w-full border-collapse text-sm print:text-[8pt]">
          <thead>
            <tr>
              {t.columns.map((c) => {
                const active = view.sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (view.dir === 1 ? "ascending" : "descending") : "none"}
                    className={cx("border-b border-line bg-page px-3 py-2 font-semibold whitespace-nowrap", alignOf(c))}
                    style={c.width ? { width: c.width } : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => view.toggleSort(c.key)}
                      className={cx("inline-flex items-center gap-1 hover:text-accent", active && "text-accent")}
                    >
                      {c.label}
                      <span aria-hidden="true" className="no-print text-xs">
                        {active ? (view.dir === 1 ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {t.rows.length === 0 && (
              <tr>
                <td colSpan={t.columns.length} className="px-3 py-6 text-center text-muted">
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
            {t.rows.slice(0, maxRows).map((r, i) => (
              <tr key={i} className="hover:bg-accent-soft/40">
                {t.columns.map((c) => (
                  <td key={c.key} className={cx("border-t border-line px-3 py-1.5", alignOf(c), c.numeric && "tabular-nums")}>
                    {r[c.key] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.rows.length > maxRows && <p className="text-xs text-muted">แสดง {maxRows} จาก {t.rows.length} แถว (ไฟล์ส่งออกมีครบทุกแถว)</p>}
      {t.footnote && <p className="text-xs text-muted">{t.footnote}</p>}
    </div>
  );
}
