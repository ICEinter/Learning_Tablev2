/**
 * ข้อกำหนดคอลัมน์ของไฟล์นำเข้าแต่ละประเภท (ใช้ทั้งแม่แบบ การจับคู่คอลัมน์ และการพรีวิว)
 * การอ้างอิงข้ามข้อมูลใช้ "รหัส" เสมอ (รหัสวิชา รหัสครู รหัสกลุ่ม รหัสห้อง)
 */
export type ImportKind = "courses" | "teachers" | "rooms" | "groups" | "students" | "assignments" | "activities";

export interface ImportColumn {
  key: string;
  header: string;
  required: boolean;
  example: string;
  help?: string;
  /** ชื่อหัวคอลัมน์อื่นที่ยอมรับในการจับคู่อัตโนมัติ */
  aliases?: string[];
}

export interface ImportSpec {
  kind: ImportKind;
  label: string;
  columns: ImportColumn[];
  order: number /* suggested import order */;
}

const LIST_HELP = "หลายรายการคั่นด้วย , หรือ ;";
const SLOT_HELP = "รูปแบบ วัน.คาบ เช่น จ.1-3, พ.7 (วัน: จ. อ. พ. พฤ. ศ. ส. อา.) ว่างได้";
const BOOL_HELP = "ใช่/ไม่ใช่ (หรือ true/false, 1/0)";

export const IMPORT_SPECS: Record<ImportKind, ImportSpec> = {
  courses: {
    kind: "courses",
    label: "รายวิชา",
    order: 1,
    columns: [
      { key: "code", header: "รหัสวิชา", required: true, example: "31901-2008", help: "ไม่ซ้ำกัน ถ้ามีอยู่แล้วจะเป็นการแก้ไข" },
      { key: "name", header: "ชื่อรายวิชา", required: true, example: "การพัฒนาซอฟต์แวร์รูปแบบเดฟออฟส์ (DevOps)" },
      { key: "theory", header: "ทฤษฎี (ท.)", required: true, example: "1", help: "จำนวนเต็ม ≥ 0", aliases: ["ท.", "ท", "ทฤษฎี"] },
      { key: "practice", header: "ปฏิบัติ (ป.)", required: true, example: "4", help: "จำนวนเต็ม ≥ 0", aliases: ["ป.", "ป", "ปฏิบัติ"] },
      { key: "credits", header: "หน่วยกิต (น.)", required: true, example: "3", help: "จำนวนเต็ม ≥ 0", aliases: ["น.", "น", "หน่วยกิต"] },
      {
        key: "periodsPerWeek",
        header: "คาบต่อสัปดาห์",
        required: false,
        example: "5",
        help: "ว่าง = ท. + ป.",
        aliases: ["ช.", "ชั่วโมงต่อสัปดาห์"],
      },
      {
        key: "blockSizes",
        header: "การแบ่งคาบต่อเนื่อง",
        required: false,
        example: "1+2+2",
        help: "ขนาดแต่ละช่วงคั่นด้วย + , หรือ ; ผลรวมต้องเท่ากับคาบต่อสัปดาห์ (ว่าง = แบ่งช่วงละ 2 คาบอัตโนมัติ)",
      },
      {
        key: "roomType",
        header: "ประเภทห้อง",
        required: true,
        example: "ห้องปฏิบัติการคอมพิวเตอร์",
        help: "ห้องบรรยาย / ห้องปฏิบัติการคอมพิวเตอร์ / ห้องปฏิบัติการวิทยาศาสตร์ / โรงฝึกงาน / ห้องปฏิบัติการภาษา / พื้นที่กิจกรรม / สถานประกอบการ/ภายนอก (หรือ lecture, computer, lab, workshop, language, activity, external)",
      },
      { key: "requiredEquipment", header: "อุปกรณ์ที่ต้องใช้", required: false, example: "คอมพิวเตอร์", help: LIST_HELP },
      { key: "department", header: "แผนกวิชา", required: false, example: "เทคโนโลยีสารสนเทศ" },
      { key: "isActivity", header: "เป็นวิชากิจกรรม", required: false, example: "ไม่ใช่", help: BOOL_HELP },
    ],
  },
  teachers: {
    kind: "teachers",
    label: "ครู",
    order: 2,
    columns: [
      { key: "code", header: "รหัสครู", required: true, example: "T005", help: "ไม่ซ้ำกัน" },
      { key: "prefix", header: "คำนำหน้า", required: true, example: "นาย", help: "นาย / นาง / นางสาว / ดร. ฯลฯ" },
      { key: "firstName", header: "ชื่อ", required: true, example: "ปกรณ์" },
      { key: "lastName", header: "นามสกุล", required: true, example: "วงศ์สวัสดิ์" },
      { key: "position", header: "ตำแหน่ง", required: true, example: "ข้าราชการครู", help: "ข้าราชการครู / พนักงานราชการ / ครูพิเศษ ฯลฯ" },
      { key: "degree", header: "วุฒิการศึกษา", required: false, example: "วิทยาศาสตรมหาบัณฑิต" },
      { key: "department", header: "แผนกวิชา", required: false, example: "เทคโนโลยีสารสนเทศและการสื่อสาร" },
      { key: "specialDuty", header: "หน้าที่พิเศษ", required: false, example: "หัวหน้างานศูนย์ดิจิทัลและสื่อสารองค์กร" },
      {
        key: "qualifiedCourses",
        header: "รหัสวิชาที่สอนได้",
        required: false,
        example: "31901-2005, 31901-2008",
        help: `${LIST_HELP} (ต้องมีรายวิชาในระบบแล้ว) ว่าง = สอนได้ทุกวิชา`,
      },
      { key: "unavailable", header: "เวลาที่ไม่ว่าง", required: false, example: "พฤ.12-13", help: SLOT_HELP },
      { key: "preferredOff", header: "เวลาที่ขอเลี่ยง", required: false, example: "", help: SLOT_HELP },
      { key: "maxPerDay", header: "สอนสูงสุดต่อวัน", required: false, example: "8", help: "จำนวนเต็ม (ว่าง = 8)" },
      { key: "maxPerWeek", header: "สอนสูงสุดต่อสัปดาห์", required: false, example: "34", help: "จำนวนเต็ม (ว่าง = 30)" },
      { key: "email", header: "อีเมล", required: false, example: "", help: "ใช้ผูกบัญชีผู้ใช้ (ว่างได้)" },
    ],
  },
  rooms: {
    kind: "rooms",
    label: "ห้อง",
    order: 3,
    columns: [
      { key: "code", header: "รหัสห้อง", required: true, example: "IT4", help: "ไม่ซ้ำกัน" },
      { key: "name", header: "ชื่อห้อง", required: true, example: "ห้องปฏิบัติการคอมพิวเตอร์ IT4" },
      { key: "capacity", header: "ความจุ", required: true, example: "30", help: "จำนวนเต็ม > 0" },
      { key: "type", header: "ประเภทห้อง", required: true, example: "ห้องปฏิบัติการคอมพิวเตอร์", help: "ดูรายการประเภทห้องในแม่แบบรายวิชา" },
      { key: "equipment", header: "อุปกรณ์", required: false, example: "คอมพิวเตอร์, โปรเจกเตอร์, GPU", help: LIST_HELP },
      { key: "unavailable", header: "เวลาที่ไม่ว่าง", required: false, example: "", help: SLOT_HELP },
    ],
  },
  groups: {
    kind: "groups",
    label: "กลุ่มเรียน",
    order: 4,
    columns: [
      { key: "code", header: "รหัสกลุ่มเรียน", required: true, example: "สIT.1/1", help: "ไม่ซ้ำกัน" },
      { key: "name", header: "ชื่อกลุ่มเรียน", required: true, example: "ปวส.1 เทคโนโลยีสารสนเทศ กลุ่ม 1" },
      { key: "level", header: "ระดับชั้น", required: true, example: "ปวส.", help: "ปวช. / ปวส." },
      { key: "department", header: "แผนกวิชา", required: false, example: "เทคโนโลยีสารสนเทศและการสื่อสาร" },
      { key: "size", header: "จำนวนผู้เรียน", required: true, example: "17", help: "จำนวนเต็ม > 0" },
      { key: "advisorTeacherCode", header: "รหัสครูที่ปรึกษา", required: false, example: "T005" },
      { key: "note", header: "หมายเหตุ", required: false, example: "", help: "เช่น จบ.ม.6,ต่างสาขา (แสดงต่อท้ายชื่อกลุ่มในตาราง)" },
    ],
  },
  students: {
    kind: "students",
    label: "นักเรียน",
    order: 5,
    columns: [
      { key: "code", header: "รหัสนักเรียน", required: true, example: "6901001", help: "ไม่ซ้ำกัน (ไม่เก็บเลขบัตร/วันเกิด/ที่อยู่/เบอร์โทร)" },
      { key: "displayName", header: "ชื่อที่แสดง", required: true, example: "กิตติ ศรีสวัสดิ์" },
      { key: "groupCode", header: "รหัสกลุ่มเรียน", required: true, example: "สIT.1/1" },
      {
        key: "extraAssignments",
        header: "รายวิชาที่ลงเพิ่ม",
        required: false,
        example: "",
        help: `รูปแบบ รหัสวิชา@รหัสกลุ่ม เช่น 30000-1407@สIT.1/1 (หรือรหัสรายการมอบหมายสอน) ${LIST_HELP}`,
      },
    ],
  },
  assignments: {
    kind: "assignments",
    label: "การมอบหมายสอน",
    order: 6,
    columns: [
      { key: "courseCode", header: "รหัสวิชา", required: true, example: "31901-2008" },
      { key: "teacherCode", header: "รหัสครู", required: true, example: "T005" },
      { key: "groupCodes", header: "รหัสกลุ่มเรียน", required: true, example: "สIT.1/1", help: `เรียนรวมหลายกลุ่ม: ${LIST_HELP}` },
      { key: "periodsPerWeek", header: "คาบต่อสัปดาห์", required: false, example: "", help: "ว่าง = ตามรายวิชา" },
      { key: "blockSizes", header: "การแบ่งคาบต่อเนื่อง", required: false, example: "", help: "ว่าง = ตามรายวิชา เช่น 2+2+1" },
      { key: "fixedRoomCode", header: "รหัสห้องที่กำหนด", required: false, example: "", help: "บังคับห้อง เช่น สถานประกอบการ (ว่าง = ให้ระบบเลือก)" },
      {
        key: "id",
        header: "รหัสรายการ (ระบบ)",
        required: false,
        example: "",
        help: "ว่างได้ — ระบบจับคู่จาก รหัสวิชา + กลุ่มเรียน; ใส่เมื่อต้องการแก้ไขรายการเดิมแบบเจาะจง",
      },
    ],
  },
  activities: {
    kind: "activities",
    label: "กิจกรรมล็อกเวลา",
    order: 7,
    columns: [
      { key: "code", header: "รหัสกิจกรรม", required: true, example: "Home Room", help: "เช่น Home Room, PLC, ชุมนุม" },
      { key: "name", header: "ชื่อกิจกรรม", required: true, example: "กิจกรรมโฮมรูม (ชั่วโมงพบครูที่ปรึกษา)" },
      { key: "day", header: "วัน", required: true, example: "พ.", help: "จ. อ. พ. พฤ. ศ. ส. อา." },
      { key: "startPeriod", header: "คาบเริ่ม", required: true, example: "7", help: "จำนวนเต็ม ≥ 1" },
      { key: "length", header: "จำนวนคาบ", required: true, example: "1", help: "จำนวนเต็ม ≥ 1" },
      { key: "appliesToAll", header: "ทุกครูและทุกกลุ่ม", required: false, example: "ไม่ใช่", help: `${BOOL_HELP} ว่าง = ไม่ใช่` },
      { key: "teacherCodes", header: "รหัสครู", required: false, example: "T005", help: LIST_HELP },
      { key: "groupCodes", header: "รหัสกลุ่มเรียน", required: false, example: "สIT.1/1", help: LIST_HELP },
      { key: "roomCode", header: "รหัสห้อง", required: false, example: "" },
      { key: "countsAsLoad", header: "นับเป็นภาระงาน", required: false, example: "ใช่", help: `${BOOL_HELP} ว่าง = ใช่` },
      { key: "id", header: "รหัสรายการ (ระบบ)", required: false, example: "", help: "ว่างได้ — ระบบจับคู่จาก รหัส + วัน + คาบ + กลุ่ม/ครู" },
    ],
  },
};

export const IMPORT_KINDS: ImportKind[] = (Object.keys(IMPORT_SPECS) as ImportKind[]).sort(
  (a, b) => IMPORT_SPECS[a].order - IMPORT_SPECS[b].order,
);

/** ข้อความอธิบายทั่วไป (ใช้ในชีต "คำอธิบาย") */
export const IMPORT_GENERAL_NOTES: string[] = [
  "แถวแรกต้องเป็นหัวคอลัมน์ ข้อมูลเริ่มที่แถวที่ 2 (แถวว่างจะถูกข้าม)",
  "คอลัมน์ที่ระบุ \"จำเป็น\" ต้องมีค่า ลำดับคอลัมน์สลับได้ ระบบจับคู่จากชื่อหัวคอลัมน์",
  "ถ้ารหัสมีอยู่ในระบบแล้ว แถวนั้นจะเป็นการ \"แก้ไข\" ข้อมูลเดิม (คอลัมน์ที่ไม่มีในไฟล์จะคงค่าเดิม)",
  "การอ้างอิงข้อมูลอื่นใช้รหัส เช่น รหัสวิชา รหัสครู รหัสกลุ่มเรียน รหัสห้อง — ต้องนำเข้าข้อมูลที่ถูกอ้างอิงก่อน",
  "ลำดับนำเข้าที่แนะนำ: รายวิชา → ครู → ห้อง → กลุ่มเรียน → นักเรียน → การมอบหมายสอน → กิจกรรม",
  "หลายรายการในช่องเดียวคั่นด้วย , หรือ ;",
  "ช่วงเวลาใช้รูปแบบ วัน.คาบ เช่น จ.1-3, พ.7 (วัน: จ. อ. พ. พฤ. ศ. ส. อา.)",
  "ค่าใช่/ไม่ใช่ รับ ใช่, ไม่ใช่, true, false, 1, 0",
  "ไฟล์ CSV ต้องเข้ารหัส UTF-8 (แม่แบบมี BOM ให้แล้ว เปิดด้วย Excel ได้ทันที)",
];

function norm(s: string): string {
  return s
    .replace(/^﻿/, "")
    .replace(/\*+$/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** จับคู่คอลัมน์ในไฟล์กับคอลัมน์ของ spec (ตามชื่อหัวคอลัมน์ / key / ชื่อสำรอง) */
export function matchColumns(spec: ImportSpec, headers: string[]): Record<string, number | null> {
  const normalized = headers.map((h) => norm(h ?? ""));
  const used = new Set<number>();
  const out: Record<string, number | null> = {};
  // รอบแรก: ตรงกับ header หรือ key; รอบสอง: aliases
  for (const pass of [0, 1] as const) {
    for (const col of spec.columns) {
      if (out[col.key] !== undefined && out[col.key] !== null) continue;
      const candidates = pass === 0 ? [col.header, col.key] : (col.aliases ?? []);
      const wanted = candidates.map(norm);
      const idx = normalized.findIndex((h, i) => !used.has(i) && h !== "" && wanted.includes(h));
      if (idx >= 0) {
        out[col.key] = idx;
        used.add(idx);
      } else if (out[col.key] === undefined) out[col.key] = null;
    }
  }
  return out;
}
