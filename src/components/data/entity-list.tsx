"use client";
/**
 * EntityList — รายการข้อมูลหลักแบบทั่วไป: ค้นหา, ตัวกรอง (จากผู้เรียกใช้), นับจำนวน,
 * แบ่งหน้า 50 รายการ, ตาราง (จอใหญ่) / การ์ด (มือถือ), แสดงปัญหา และลบพร้อมตรวจการอ้างอิง
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import { Button, DataTable, EmptyState, Input, Select } from "@/components/ui";
import { entityLabel } from "@/shared/integrity";
import type { EntityKind } from "@/shared/types";
import { DeleteDialog } from "./delete-dialog";
import { IssueBadge } from "./issue-badge";
import { useLookups } from "./lookups";
import { Pagination, pageSlice } from "./pagination";

export interface ListColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function EntityList<T extends { id: string }>({
  kind,
  items,
  totalCount,
  columns,
  searchText,
  searchPlaceholder = "ค้นหา…",
  filters,
  cardTitle,
  cardMeta,
  rowLabel,
  onAdd,
  onEdit,
  toolbar,
}: {
  kind: EntityKind;
  /** รายการหลังผ่านตัวกรองของผู้เรียกใช้ */
  items: T[];
  totalCount: number;
  columns: ListColumn<T>[];
  searchText: (row: T) => string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  cardTitle: (row: T) => ReactNode;
  cardMeta: (row: T) => ReactNode;
  rowLabel: (row: T) => string;
  onAdd: () => void;
  onEdit: (row: T) => void;
  toolbar?: ReactNode;
}) {
  const lk = useLookups();
  const searchId = useId();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);
  const label = entityLabel(kind);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((row) => (!s || searchText(row).toLowerCase().includes(s)) && (!onlyIssues || lk.issuesFor(kind, row.id).length > 0));
  }, [items, q, searchText, onlyIssues, lk, kind]);
  const { rows, page: current, pageCount } = pageSlice(filtered, page);

  const actions = (row: T) => (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => onEdit(row)} aria-label={`แก้ไข ${rowLabel(row)}`}>
        แก้ไข
      </Button>
      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting({ id: row.id, label: rowLabel(row) })} aria-label={`ลบ ${rowLabel(row)}`}>
        ลบ
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label htmlFor={searchId} className="text-xs font-medium text-muted">
            ค้นหา{label}
          </label>
          <Input
            id={searchId}
            type="search"
            value={q}
            placeholder={searchPlaceholder}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {filters}
        <label className="inline-flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
          เฉพาะที่มีปัญหา
        </label>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {toolbar}
          <Button variant="primary" onClick={onAdd}>
            + เพิ่ม{label}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        พบ {filtered.length} รายการ{filtered.length !== totalCount ? ` (จากทั้งหมด ${totalCount})` : ""}
      </p>

      {filtered.length === 0 ? (
        <EmptyState title={totalCount === 0 ? `ยังไม่มีข้อมูล${label}` : "ไม่พบรายการที่ตรงเงื่อนไข"}>
          {totalCount === 0 ? "เพิ่มทีละรายการ หรือใช้หน้านำเข้าข้อมูลจาก Excel/CSV" : "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"}
        </EmptyState>
      ) : (
        <>
          {/* มือถือ: การ์ด */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 font-medium break-words">{cardTitle(row)}</div>
                  {actions(row)}
                </div>
                <div className="mt-1 text-sm text-muted break-words">{cardMeta(row)}</div>
                <div className="mt-2">
                  <IssueBadge issues={lk.issuesFor(kind, row.id)} />
                </div>
              </li>
            ))}
          </ul>
          {/* แท็บเล็ต/เดสก์ท็อป: ตาราง (เลื่อนแนวนอนภายในกรอบ) */}
          <DataTable className="hidden md:block">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header} scope="col" className={c.className}>
                    {c.header}
                  </th>
                ))}
                <th scope="col">สถานะข้อมูล</th>
                <th scope="col" className="text-right">
                  <span className="sr-only">จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-accent-soft/40">
                  {columns.map((c) => (
                    <td key={c.header} className={c.className}>
                      {c.cell(row)}
                    </td>
                  ))}
                  <td>
                    <IssueBadge issues={lk.issuesFor(kind, row.id)} />
                  </td>
                  <td>{actions(row)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={current} pageCount={pageCount} total={filtered.length} onChange={setPage} />
        </>
      )}

      <DeleteDialog kind={kind} target={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

/** ตัวกรองแบบ select ที่มีป้ายกำกับ */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "ทั้งหมด",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-[9rem] flex-col gap-1 sm:max-w-[16rem]">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
