"use client";
import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui";
import { parseNumberList } from "./form-utils";

/** ช่องตัวเลข — เก็บค่าเป็น string เพื่อให้ลบจนว่างได้ (แปลงตอนบันทึก) */
export function NumberInput({
  value,
  onChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & { value: string; onChange: (v: string) => void }) {
  return <Input {...rest} type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** สรุปผลรวมของรายการคาบต่อเนื่อง เช่น "1,2,2" เทียบกับจำนวนคาบต่อสัปดาห์ */
export function BlockSumHint({ blocks, expected }: { blocks: string; expected: number | undefined }) {
  const list = parseNumberList(blocks);
  if (list === null) return <p className="text-xs text-danger">รูปแบบไม่ถูกต้อง — ใช้จำนวนเต็มบวกคั่นด้วยจุลภาค เช่น 1,2,2</p>;
  if (list.length === 0) return null;
  const sum = list.reduce((s, n) => s + n, 0);
  const known = expected !== undefined && !Number.isNaN(expected);
  const ok = !known || sum === expected;
  return (
    <p className={ok ? "text-xs text-ok" : "text-xs text-warn"} aria-live="polite">
      {ok ? "✓ " : "⚠ "}
      {list.length} ช่วง รวม {sum} คาบ
      {known && !ok ? ` (ต้องเท่ากับ ${expected} คาบ)` : ""}
    </p>
  );
}
