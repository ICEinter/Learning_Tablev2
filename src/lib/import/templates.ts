/**
 * สร้างไฟล์แม่แบบนำเข้า (.xlsx พร้อมชีตคำอธิบาย / .csv UTF-8 BOM)
 * ตัวอย่างข้อมูลใช้รูปแบบเดียวกับข้อมูลสาธิต (src/data/mock.ts)
 */
import { loadExcelJs } from "./parse";
import type { ImportKind } from "./specs";
import { IMPORT_GENERAL_NOTES, IMPORT_SPECS } from "./specs";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const CSV_MIME = "text/csv;charset=utf-8";

/** แถวตัวอย่างที่ 2 (แถวที่ 1 มาจาก column.example) */
const SECOND_EXAMPLE: Record<ImportKind, Record<string, string>> = {
  courses: {
    code: "30000-1407",
    name: "คณิตศาสตร์อุตสาหกรรม",
    theory: "3",
    practice: "0",
    credits: "3",
    periodsPerWeek: "3",
    blockSizes: "2+1",
    roomType: "ห้องบรรยาย",
    requiredEquipment: "",
    department: "สามัญสัมพันธ์",
    isActivity: "ไม่ใช่",
  },
  teachers: {
    code: "T011",
    prefix: "นาง",
    firstName: "วันเพ็ญ",
    lastName: "ประเสริฐ",
    position: "ข้าราชการครู",
    degree: "ปริญญาตรี",
    department: "สามัญสัมพันธ์",
    specialDuty: "",
    qualifiedCourses: "30000-1212; 20000-1201",
    unavailable: "",
    preferredOff: "ศ.7-9",
    maxPerDay: "8",
    maxPerWeek: "30",
    email: "",
  },
  rooms: {
    code: "2513",
    name: "ห้องบรรยาย 2513",
    capacity: "45",
    type: "ห้องบรรยาย",
    equipment: "โปรเจกเตอร์",
    unavailable: "",
  },
  groups: {
    code: "สIT.1/2",
    name: "ปวส.1 เทคโนโลยีสารสนเทศ กลุ่ม 2",
    level: "ปวส.",
    department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
    size: "29",
    advisorTeacherCode: "T006",
    note: "จบ.ม.6,ต่างสาขา",
  },
  students: {
    code: "6904001",
    displayName: "ณัฐวุฒิ บุญเรือง",
    groupCode: "สIT.2/2",
    extraAssignments: "30000-1407@สIT.1/1",
  },
  assignments: {
    courseCode: "20000-2001",
    teacherCode: "T008",
    groupCodes: "ชIT.1/1, ชIT.2/1, ชIT.3/1",
    periodsPerWeek: "",
    blockSizes: "",
    fixedRoomCode: "กิจกรรม",
    id: "",
  },
  activities: {
    code: "PLC",
    name: "ชุมชนการเรียนรู้ทางวิชาชีพ (PLC)",
    day: "พ.",
    startPeriod: "10",
    length: "2",
    appliesToAll: "ไม่ใช่",
    teacherCodes: "T001, T002, T003",
    groupCodes: "",
    roomCode: "",
    countsAsLoad: "ใช่",
    id: "",
  },
};

export function templateRows(kind: ImportKind): string[][] {
  const spec = IMPORT_SPECS[kind];
  const first = spec.columns.map((c) => c.example);
  const second = spec.columns.map((c) => SECOND_EXAMPLE[kind][c.key] ?? "");
  return [first, second];
}

export function templateFileName(kind: ImportKind, format: "xlsx" | "csv"): string {
  return `แม่แบบนำเข้า-${IMPORT_SPECS[kind].label}.${format}`;
}

function csvEscape(v: string): string {
  return /[",\r\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** สร้างข้อความ CSV (CRLF) */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => csvEscape(String(c ?? ""))).join(",")).join("\r\n") + "\r\n";
}

export async function buildTemplate(kind: ImportKind, format: "xlsx" | "csv"): Promise<Blob> {
  const spec = IMPORT_SPECS[kind];
  const headers = spec.columns.map((c) => c.header);
  const rows = templateRows(kind);
  if (format === "csv") {
    return new Blob(["﻿" + toCsv([headers, ...rows])], { type: CSV_MIME });
  }

  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Learning Table";
  const ws = wb.addWorksheet(spec.label, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = spec.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: Math.min(45, Math.max(12, c.header.length * 1.6, c.example.length * 1.1, (SECOND_EXAMPLE[kind][c.key] ?? "").length * 1.1)),
    style: { numFmt: "@", font: { name: "Tahoma", size: 10 } },
  }));
  rows.forEach((r) => ws.addRow(r));
  const head = ws.getRow(1);
  head.height = 22;
  spec.columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.font = { name: "Tahoma", size: 10, bold: true, color: { argb: c.required ? "FFFFFFFF" : "FF1F2937" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.required ? "FF2563EB" : "FFE5E7EB" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.note = `${c.required ? "จำเป็น" : "ไม่บังคับ"}${c.help ? ` — ${c.help}` : ""}`;
  });

  const help = wb.addWorksheet("คำอธิบาย");
  help.columns = [
    { header: "หัวคอลัมน์", key: "header", width: 26 },
    { header: "จำเป็น", key: "required", width: 10 },
    { header: "ตัวอย่าง", key: "example", width: 32 },
    { header: "คำอธิบาย / รูปแบบ", key: "help", width: 80 },
  ];
  spec.columns.forEach((c) =>
    help.addRow({ header: c.header, required: c.required ? "จำเป็น" : "-", example: c.example, help: c.help ?? "" }),
  );
  help.addRow([]);
  help.addRow(["ข้อควรทราบ"]).font = { bold: true, name: "Tahoma" };
  IMPORT_GENERAL_NOTES.forEach((n) => help.addRow([`• ${n}`]));
  help.eachRow((row, n) => {
    row.eachCell((cell) => {
      cell.font = { name: "Tahoma", size: 10, bold: n === 1 || Boolean(cell.font?.bold) };
      cell.alignment = { vertical: "top", wrapText: n <= spec.columns.length + 1 };
    });
  });
  help.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], { type: XLSX_MIME });
}
