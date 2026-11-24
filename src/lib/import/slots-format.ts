/**
 * แปลงรายการช่วงเวลา (slot) ระหว่างข้อความภาษาไทยแบบย่อ กับ SlotRef[]
 *   "จ.1-3, พ.7"  <->  [{day:0,period:1},{day:0,period:2},{day:0,period:3},{day:2,period:7}]
 * วัน: จ. อ. พ. พฤ. ศ. ส. อา. (รับชื่อเต็ม เช่น "จันทร์", "วันพุธ" ได้ด้วย)
 * โทเคนที่ไม่มีวันนำหน้าจะใช้วันของโทเคนก่อนหน้า เช่น "จ.1-2, 5" = จันทร์คาบ 1,2,5
 */
import type { SlotRef } from "@/shared/types";

export const DAY_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."] as const;

const DAY_ALIASES: Record<string, number> = {
  จ: 0,
  จันทร์: 0,
  อ: 1,
  อังคาร: 1,
  พ: 2,
  พุธ: 2,
  พฤ: 3,
  พฤหัส: 3,
  พฤหัสบดี: 3,
  ศ: 4,
  ศุกร์: 4,
  ส: 5,
  เสาร์: 5,
  อา: 6,
  อาทิตย์: 6,
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/** แปลงเลขไทยเป็นเลขอารบิก */
export function normalizeDigits(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

/** แปลงชื่อวัน (ย่อ/เต็ม) เป็น index 0..6 หรือ null */
export function parseDay(text: string): number | null {
  const k = text
    .trim()
    .replace(/^วัน/, "")
    .replace(/\./g, "")
    .trim()
    .toLowerCase();
  if (!k) return null;
  if (k in DAY_ALIASES) return DAY_ALIASES[k];
  const en = k.slice(0, 3);
  if (/^[a-z]{3}/.test(k) && en in DAY_ALIASES) return DAY_ALIASES[en];
  return null;
}

export function formatDay(day: number, shorts?: readonly string[]): string {
  return (shorts ?? DAY_SHORT)[day] ?? String(day);
}

export interface SlotListResult {
  slots: SlotRef[];
  errors: string[];
}

export interface SlotListOptions {
  /** จำนวนคาบต่อวัน (ถ้าระบุจะตรวจว่าเลขคาบไม่เกิน) */
  maxPeriod?: number;
}

/** แยกข้อความรายการช่วงเวลา เช่น "จ.1-3, พ.7" (คั่นด้วย , หรือ ;) */
export function parseSlotList(text: string, opts: SlotListOptions = {}): SlotListResult {
  const errors: string[] = [];
  const set = new Map<string, SlotRef>();
  const src = normalizeDigits(text ?? "").trim();
  if (!src) return { slots: [], errors };
  let currentDay: number | null = null;
  for (const rawTok of src.split(/[,;\n]/)) {
    const tok = rawTok.trim();
    if (!tok) continue;
    const m = /^([^\d\s-][^\d]*?)?\s*(\d+)\s*(?:-\s*(\d+))?$/.exec(tok);
    if (!m) {
      errors.push(`รูปแบบช่วงเวลาไม่ถูกต้อง: "${tok}" (ตัวอย่าง: จ.1-3, พ.7)`);
      continue;
    }
    if (m[1] && m[1].trim()) {
      const d = parseDay(m[1]);
      if (d === null) {
        errors.push(`ไม่รู้จักวัน "${m[1].trim()}" (ใช้ จ. อ. พ. พฤ. ศ. ส. อา.)`);
        continue;
      }
      currentDay = d;
    }
    if (currentDay === null) {
      errors.push(`ไม่ได้ระบุวันใน "${tok}" (ตัวอย่าง: จ.1-3)`);
      continue;
    }
    const a = Number(m[2]);
    const b = m[3] !== undefined ? Number(m[3]) : a;
    if (a < 1 || b < a) {
      errors.push(`ช่วงคาบไม่ถูกต้อง: "${tok}"`);
      continue;
    }
    if (opts.maxPeriod && b > opts.maxPeriod) {
      errors.push(`คาบ ${b} เกินจำนวนคาบต่อวัน (${opts.maxPeriod}) ใน "${tok}"`);
      continue;
    }
    for (let p = a; p <= b; p++) set.set(`${currentDay}:${p}`, { day: currentDay, period: p });
  }
  const slots = [...set.values()].sort((x, y) => x.day - y.day || x.period - y.period);
  return { slots, errors };
}

/** SlotRef[] -> "จ.1-3, พ.7" (รวมคาบติดกันเป็นช่วง) */
export function formatSlotList(slots: SlotRef[], dayShorts?: readonly string[]): string {
  const byDay = new Map<number, number[]>();
  for (const s of slots) {
    const arr = byDay.get(s.day) ?? [];
    if (!arr.includes(s.period)) arr.push(s.period);
    byDay.set(s.day, arr);
  }
  const parts: string[] = [];
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    const ps = byDay.get(day)!.sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = ps[0];
    let prev = ps[0];
    for (let i = 1; i <= ps.length; i++) {
      const p = ps[i];
      if (p === prev + 1) {
        prev = p;
        continue;
      }
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = p;
      prev = p;
    }
    parts.push(`${formatDay(day, dayShorts)}${ranges.join(`, `)}`);
  }
  return parts.join(", ");
}
