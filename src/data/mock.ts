/**
 * ชุดข้อมูลหลักของระบบ: วิทยาลัยเทคนิคระยอง (แผนกวิชาเทคโนโลยีสารสนเทศและการสื่อสาร)
 * ปรับปรุงให้ใช้ข้อมูลจริงจากไฟล์แนบแทนข้อมูลจำลองเดิมทั้งหมด 100%
 */
import { createRayongDataset, createOfficialParinyaPlacements, createOfficialRayongTimetable, RAYONG_DAYS, rayongPeriods } from "./rayong";
import type { Dataset, DayDef, Placement, TimetableVersion } from "@/shared/types";

export const THAI_DAYS: DayDef[] = RAYONG_DAYS;

export function hourlyPeriods() {
  return rayongPeriods();
}

/** คืนชุดข้อมูลวิทยาลัยเทคนิคระยองตามไฟล์แนบจริง */
export function createMockDataset(): Dataset {
  return createRayongDataset();
}

/** คืนตารางสอนทางการของ อ.ปริญญา จำเนียรพล (33 ชม.) ตามไฟล์แนบ */
export function mockPlacements(dataset: Dataset = createRayongDataset()): Placement[] {
  return createOfficialParinyaPlacements(dataset);
}

/** คืนเวอร์ชันตารางสอนทางการที่เผยแพร่แล้ว */
export function createMockTimetable(dataset: Dataset = createRayongDataset()): TimetableVersion {
  return createOfficialRayongTimetable(dataset);
}
