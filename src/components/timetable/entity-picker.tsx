"use client";
import { useId, useMemo, useState } from "react";
import { Button, Input, Select } from "@/components/ui";

/** ตัวเลือก entity พร้อมช่องค้นหา และปุ่มก่อนหน้า/ถัดไป */
export function EntityPicker({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const [q, setQ] = useState("");
  const id = useId();
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
    // ให้ตัวที่เลือกอยู่แสดงเสมอ
    if (value && !list.some((o) => o.id === value)) {
      const cur = options.find((o) => o.id === value);
      if (cur) return [cur, ...list];
    }
    return list;
  }, [options, q, value]);
  const idx = options.findIndex((o) => o.id === value);
  const go = (d: number) => {
    if (options.length === 0) return;
    const n = (idx + d + options.length) % options.length;
    onChange(options[n].id);
  };
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex min-w-0 gap-2">
          <Input
            aria-label={`ค้นหา${label}`}
            placeholder="ค้นหา…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-28 shrink-0 sm:w-40"
          />
          <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1">
            {filtered.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex gap-1">
        <Button size="md" aria-label="ก่อนหน้า" onClick={() => go(-1)} disabled={options.length < 2}>
          ‹ ก่อนหน้า
        </Button>
        <Button size="md" aria-label="ถัดไป" onClick={() => go(1)} disabled={options.length < 2}>
          ถัดไป ›
        </Button>
      </div>
      <span className="pb-2 text-xs text-muted tabular-nums">
        {idx + 1}/{options.length}
      </span>
    </div>
  );
}
