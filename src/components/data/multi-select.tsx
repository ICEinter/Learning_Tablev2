"use client";
import { useId, useMemo, useState } from "react";
import { Input, cx } from "@/components/ui";

export interface MultiOption {
  value: string;
  label: string;
  hint?: string;
}

const VISIBLE_LIMIT = 100;

/** เลือกหลายรายการพร้อมช่องค้นหา (ตัวเลือกแสดงเป็น checkbox ในกล่องเลื่อน) */
export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "ค้นหา…",
  emptyText = "ไม่พบรายการ",
}: {
  id?: string;
  options: MultiOption[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const listId = useId();
  const selected = useMemo(() => new Set(value), [value]);
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return options.filter(
      (o) => (!onlySelected || selected.has(o.value)) && (!s || `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(s)),
    );
  }, [options, q, onlySelected, selected]);
  const visible = filtered.slice(0, VISIBLE_LIMIT);

  const toggle = (v: string) => onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  const selectVisible = () => onChange([...value, ...visible.map((o) => o.value).filter((v) => !selected.has(v))]);

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="รายการที่เลือก">
          {value.map((v) => {
            const o = byValue.get(v);
            return (
              <li
                key={v}
                className={cx(
                  "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                  o ? "border-accent/30 bg-accent-soft text-accent" : "border-danger/30 bg-danger-soft text-danger",
                )}
              >
                <span className="truncate">{o ? o.label : `(ไม่พบ) ${v}`}</span>
                <button type="button" aria-label={`เอา ${o?.label ?? v} ออก`} className="rounded hover:text-danger" onClick={() => toggle(v)}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-controls={listId} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          เลือกแล้ว {value.length} / {options.length}
        </span>
        <button type="button" className="text-accent hover:underline" onClick={selectVisible}>
          เลือกที่แสดงทั้งหมด
        </button>
        <button type="button" className="text-accent hover:underline disabled:opacity-50" disabled={!value.length} onClick={() => onChange([])}>
          ล้าง
        </button>
        <label className="inline-flex items-center gap-1">
          <input type="checkbox" className="accent-[var(--color-accent)]" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
          เฉพาะที่เลือก
        </label>
      </div>
      <div id={listId} role="group" aria-label="ตัวเลือก" className="max-h-52 overflow-y-auto rounded-md border border-line">
        {visible.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted">{emptyText}</p>
        ) : (
          visible.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-start gap-2 border-b border-line px-3 py-1.5 text-sm last:border-b-0 hover:bg-accent-soft">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
              />
              <span className="min-w-0">
                <span className="block break-words">{o.label}</span>
                {o.hint && <span className="block text-xs text-muted">{o.hint}</span>}
              </span>
            </label>
          ))
        )}
        {filtered.length > VISIBLE_LIMIT && (
          <p className="px-3 py-2 text-xs text-muted">
            แสดง {VISIBLE_LIMIT} จาก {filtered.length} รายการ — พิมพ์เพื่อค้นหาเพิ่มเติม
          </p>
        )}
      </div>
    </div>
  );
}
