/**
 * ตัวช่วยฟอร์มข้อมูลหลัก: แปลงผล Zod เป็น error รายฟิลด์, แปลงตัวเลข, ตรวจรหัสซ้ำ
 */
import type { z } from "zod";

/** key = ชื่อฟิลด์ระดับบนสุด (เช่น "code", "blockSizes"), "_form" = ข้อผิดพลาดทั่วไป */
export type FieldErrors = Record<string, string>;

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** ตรวจค่าด้วย schema แล้วคืน error รายฟิลด์ (ว่าง = ผ่าน) */
export function schemaErrors(schema: z.ZodType, value: unknown): FieldErrors {
  const r = schema.safeParse(value);
  return r.success ? {} : zodFieldErrors(r.error);
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** "" -> NaN (ให้ Zod แจ้งว่า "ต้องเป็นตัวเลข") */
export function toNumber(s: string): number {
  const t = s.trim();
  return t === "" ? Number.NaN : Number(t);
}

/** "" -> undefined, อื่น ๆ -> Number */
export function toOptionalNumber(s: string): number | undefined {
  return s.trim() === "" ? undefined : Number(s.trim());
}

/** "1,2,2" -> [1,2,2]; "" -> []; รูปแบบผิด -> null */
export function parseNumberList(s: string): number[] | null {
  const t = s.trim();
  if (!t) return [];
  const nums = t.split(/[,\s+]+/).filter(Boolean).map(Number);
  return nums.every((n) => Number.isInteger(n) && n > 0) ? nums : null;
}

export function optionalText(s: string): string | undefined {
  const t = s.trim();
  return t ? t : undefined;
}

export function isDuplicateCode(items: readonly { id: string; code: string }[], code: string, selfId: string): boolean {
  const key = code.trim().toUpperCase();
  return key !== "" && items.some((x) => x.id !== selfId && x.code.trim().toUpperCase() === key);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
