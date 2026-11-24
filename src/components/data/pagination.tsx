"use client";
import { Button } from "@/components/ui";

export const PAGE_SIZE = 50;

export function pageSlice<T>(items: T[], page: number, size = PAGE_SIZE): { rows: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return { rows: items.slice((current - 1) * size, current * size), page: current, pageCount };
}

export function Pagination({ page, pageCount, total, onChange, size = PAGE_SIZE }: { page: number; pageCount: number; total: number; onChange: (p: number) => void; size?: number }) {
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted" aria-label="เปลี่ยนหน้า">
      <span>
        แสดง {from}–{to} จาก {total} รายการ
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="หน้าก่อนหน้า">
            ‹ ก่อนหน้า
          </Button>
          <span className="tabular-nums">
            หน้า {page} / {pageCount}
          </span>
          <Button size="sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="หน้าถัดไป">
            ถัดไป ›
          </Button>
        </div>
      )}
    </nav>
  );
}
