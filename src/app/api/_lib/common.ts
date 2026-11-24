import { z } from "zod";
import { isAdminConfigured } from "@/lib/firebase/admin";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { HttpError } from "@/lib/auth/server";
import type { Dataset, Placement } from "@/shared/types";
import type { ValidationResult } from "@/engine/types";

/** โหมดสาธิตฝั่ง server: ไม่มีทั้ง Admin SDK และ client config */
export function isDemoServer(): boolean {
  return !isAdminConfigured() && !isFirebaseConfigured();
}

export const DocIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "รหัสเอกสารต้องเป็น A-Z a-z 0-9 _ - ไม่เกิน 64 ตัวอักษร");

export function parseId(id: string): string {
  const r = DocIdSchema.safeParse(id);
  if (!r.success) throw new HttpError(400, "รหัสตารางไม่ถูกต้อง");
  return r.data;
}

/** โหลด engine แบบ lazy (ลดขนาด cold start ของ route ที่ไม่ต้องใช้) */
export async function runValidate(ds: Dataset, placements: Placement[]): Promise<ValidationResult> {
  const engine = await import("@/engine");
  return engine.validate(ds, placements);
}
