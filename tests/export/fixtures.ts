/**
 * placements ที่เขียนเองสำหรับทดสอบ export (ไม่พึ่ง engine)
 * ครอบคลุมรายการสอนของครู t05 (นายปกรณ์) และบางรายการของกลุ่ม สIT.1/1
 */
import type { Placement } from "@/shared/types";

const P = (assignmentId: string, block: number, day: number, period: number, roomId: string): Placement => ({
  assignmentId,
  block,
  day,
  period,
  roomId,
});

export function mockPlacements(): Placement[] {
  return [
    // t05
    P("a-001", 0, 0, 1, "r-it1"),
    P("a-001", 1, 0, 2, "r-it1"),
    P("a-001", 2, 1, 1, "r-it1"),
    P("a-002", 0, 2, 1, "r-it2"),
    P("a-002", 1, 2, 2, "r-it2"),
    P("a-002", 2, 3, 1, "r-it2"),
    P("a-003", 0, 4, 1, "r-it4"),
    P("a-003", 1, 4, 2, "r-it4"),
    P("a-004", 0, 1, 5, "r-act"),
    P("a-010", 0, 0, 5, "r-it2"),
    P("a-010", 1, 0, 6, "r-it2"),
    P("a-010", 2, 3, 5, "r-it2"),
    P("a-011", 0, 1, 8, "r-it1"),
    P("a-011", 1, 1, 9, "r-it1"),
    P("a-011", 2, 4, 8, "r-it1"),
    // สIT.1/1 วิชาอื่น
    P("a-005", 0, 2, 4, "r-it3"),
    P("a-005", 1, 3, 3, "r-it3"),
    P("a-005", 2, 0, 8, "r-it3"),
    P("a-006", 0, 1, 3, "r-lc03"),
    P("a-008", 0, 3, 7, "r-2513"),
    P("a-008", 1, 4, 6, "r-2513"),
  ];
}
