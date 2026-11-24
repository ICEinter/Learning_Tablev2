import type { Assignment, Course, Dataset, Period, SlotRef, TimeStructure } from "./types";

/** จำนวนคาบต่อวัน (รวมคาบพัก) */
export function periodsPerDay(time: TimeStructure): number {
  return time.periods.length;
}

/** slot index = day * P + (period - 1) */
export function slotIndex(time: TimeStructure, ref: SlotRef): number {
  return ref.day * time.periods.length + (ref.period - 1);
}

export function slotRef(time: TimeStructure, index: number): SlotRef {
  const P = time.periods.length;
  return { day: Math.floor(index / P), period: (index % P) + 1 };
}

export function totalSlots(time: TimeStructure): number {
  return time.days.length * time.periods.length;
}

export function periodByNo(time: TimeStructure, no: number): Period | undefined {
  return time.periods.find((p) => p.no === no);
}

export function isBreak(time: TimeStructure, period: number): boolean {
  return Boolean(periodByNo(time, period)?.isBreak);
}

export function isDayActive(time: TimeStructure, day: number): boolean {
  return Boolean(time.days.find((d) => d.index === day)?.active);
}

/** "08:30" -> 510 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function slotKey(ref: SlotRef): string {
  return `${ref.day}:${ref.period}`;
}

/** blockSizes ที่มีผลจริงของรายการมอบหมายสอน */
export function effectiveBlocks(a: Assignment, course: Course | undefined): number[] {
  if (a.blockSizes && a.blockSizes.length) return a.blockSizes;
  if (a.periodsPerWeek && course && a.periodsPerWeek !== course.periodsPerWeek) {
    // แบ่ง periodsPerWeek ตามขนาด block ใหญ่สุดของวิชา
    const max = Math.max(1, ...course.blockSizes);
    const out: number[] = [];
    let left = a.periodsPerWeek;
    while (left > 0) {
      const s = Math.min(max, left);
      out.push(s);
      left -= s;
    }
    return out;
  }
  return course ? course.blockSizes : [a.periodsPerWeek ?? 1];
}

export function effectivePeriods(a: Assignment, course: Course | undefined): number {
  return effectiveBlocks(a, course).reduce((s, n) => s + n, 0);
}

/** ช่วงคาบที่ block ครอบคลุม */
export function blockPeriods(start: number, length: number): number[] {
  return Array.from({ length }, (_, i) => start + i);
}

export function teacherName(t: { prefix: string; firstName: string; lastName: string }): string {
  return `${t.prefix}${t.firstName} ${t.lastName}`;
}

export function termLabel(ds: Pick<Dataset, "term">): string {
  return `${ds.term.term}/${ds.term.year}`;
}

export function periodTimeLabel(p: Period): string {
  return `${p.start} - ${p.end}`;
}
