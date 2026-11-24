/**
 * Export Excel ด้วย exceljs (โหลดแบบ dynamic ทำงานได้ทั้งเบราว์เซอร์และ Node)
 * ค่าในเซลล์เป็นข้อความ/ตัวเลขจริงที่แก้ไขได้ ไม่ใช่รูปภาพ
 */
import type { Borders, Cell, Worksheet } from "exceljs";
import type { SchoolInfo } from "@/shared/types";
import type { GridCell, TimetableGrid } from "@/lib/timetable/viewmodel";
import type { ReportTable } from "@/lib/reports/types";
import { loadExcelJs } from "@/lib/import/parse";
import { downloadBlob, safeFileName } from "./download";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const FONT = "Tahoma";
const THIN: Partial<Borders> = {
  top: { style: "thin", color: { argb: "FF6B7280" } },
  left: { style: "thin", color: { argb: "FF6B7280" } },
  bottom: { style: "thin", color: { argb: "FF6B7280" } },
  right: { style: "thin", color: { argb: "FF6B7280" } },
};
const FILL = {
  header: "FFF3F4F6",
  activity: "FFE5E7EB",
  break: "FFF3F4F6",
  conflict: "FFFDE2E2",
};

const VIEW_HEADING: Record<TimetableGrid["kind"], string> = {
  teacher: "ตารางสอน",
  group: "ตารางเรียน",
  student: "ตารางเรียน",
  room: "ตารางการใช้ห้อง",
  course: "ตารางรายวิชา",
};

/** ชื่อชีต: ≤ 31 ตัวอักษร ไม่ซ้ำ ไม่มี []:*?/\ */
export function makeSheetName(name: string, used: Set<string>): string {
  let base = (name || "Sheet")
    .replace(/[[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "");
  if (!base) base = "Sheet";
  base = base.slice(0, 31).trim();
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length).trim() + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function merge(ws: Worksheet, r1: number, c1: number, r2: number, c2: number) {
  if (r1 === r2 && c1 === c2) return;
  ws.mergeCells(r1, c1, r2, c2);
}

function style(cell: Cell, opts: { bold?: boolean; size?: number; fill?: string; border?: boolean; h?: "left" | "center" | "right"; v?: "top" | "middle"; wrap?: boolean; rotate?: number }) {
  cell.font = { name: FONT, size: opts.size ?? 9, bold: Boolean(opts.bold) };
  cell.alignment = {
    horizontal: opts.h ?? "left",
    vertical: opts.v ?? "middle",
    wrapText: opts.wrap ?? true,
    ...(opts.rotate ? { textRotation: opts.rotate } : {}),
  };
  if (opts.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
  if (opts.border) cell.border = THIN;
}

/** ใส่ค่า+สไตล์ให้ช่วงเซลล์ที่รวมกัน (ใส่เส้นขอบทุกเซลล์ในช่วงเพื่อให้พิมพ์ครบ) */
function put(
  ws: Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  value: string | number | null,
  opts: Parameters<typeof style>[1] = {},
) {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      style(cell, opts);
    }
  merge(ws, r1, c1, r2, c2);
  ws.getCell(r1, c1).value = value === null || value === "" ? null : value;
}

function cellValue(cell: GridCell, grid: TimetableGrid): string {
  if (cell.state === "break") return grid.periods[cell.startPeriod - 1]?.label ?? "พัก";
  return cell.items.map((it) => it.lines.filter((l) => l && l.trim()).join("\n")).join("\n―\n");
}

function writeTimetableSheet(ws: Worksheet, grid: TimetableGrid, school: SchoolInfo) {
  const P = grid.periods.length;
  const hasPre = Boolean(grid.preActivity);
  const first = hasPre ? 3 : 2; // คอลัมน์ของคาบที่ 1
  const N = first - 1 + P;

  // ความกว้างคอลัมน์
  ws.getColumn(1).width = 12;
  if (hasPre) ws.getColumn(2).width = 6;
  for (let p = 0; p < P; p++) ws.getColumn(first + p).width = 11.5;

  // หัวเรื่อง
  put(ws, 1, 1, 1, N, `${VIEW_HEADING[grid.kind]} ${grid.title}`, { bold: true, size: 14, h: "center", wrap: false });
  ws.getRow(1).height = 22;

  // บล็อกซ้าย (ข้อมูล) และขวา (สรุปรายวิชา)
  let L = Math.max(2, Math.min(Math.floor(N * 0.35), N - 6));
  let stacked = false;
  if (N - L < 6) {
    stacked = true;
    L = N;
  }
  const r = 2;
  put(ws, r, 1, r, L, school.name, { bold: true, size: 11 });
  grid.meta.forEach((m, i) => {
    put(ws, r + 1 + i, 1, r + 1 + i, 1, m.label, { bold: true });
    put(ws, r + 1 + i, 2, r + 1 + i, L, m.value, {});
  });
  const leftEnd = r + grid.meta.length;

  const sTop = stacked ? leftEnd + 2 : 2;
  const c0 = stacked ? 1 : L + 1;
  const right = N - c0 + 1;
  const codeCols = right >= 8 ? 2 : 1;
  const nameCols = Math.max(1, right - 4 - codeCols);
  const cCode = c0;
  const cName = c0 + codeCols;
  const cT = cName + nameCols;
  const hdr = { bold: true, fill: FILL.header, border: true, h: "center" as const, size: 8 };
  put(ws, sTop, cCode, sTop, cCode + codeCols - 1, "รหัสวิชา", hdr);
  put(ws, sTop, cName, sTop, cT - 1, "ชื่อรายวิชา", hdr);
  ["ท.", "ป.", "น.", "ช."].forEach((t, i) => put(ws, sTop, cT + i, sTop, cT + i, t, hdr));
  let sr = sTop + 1;
  for (const s of grid.summary) {
    const base = { border: true, size: 8, fill: s.isActivity ? FILL.activity : undefined };
    put(ws, sr, cCode, sr, cCode + codeCols - 1, s.code, base);
    put(ws, sr, cName, sr, cT - 1, s.name, base);
    [s.theory, s.practice, s.credits, s.hours].forEach((v, i) => put(ws, sr, cT + i, sr, cT + i, v, { ...base, h: "center" }));
    sr++;
  }
  put(ws, sr, cCode, sr, cT - 1, "รวม", { bold: true, border: true, size: 8, h: "right" });
  [grid.totals.theory, grid.totals.practice, grid.totals.credits, grid.totals.hours].forEach((v, i) =>
    put(ws, sr, cT + i, sr, cT + i, v, { bold: true, border: true, size: 8, h: "center" }),
  );
  sr++;
  put(ws, sr, cCode, sr, cT + 3, `(รวมใน: ${grid.stats.inRegular}) (รวมนอก: ${grid.stats.outRegular})`, { size: 8, h: "right" });
  const blockEnd = Math.max(leftEnd, sr);

  // ตาราง
  const h1 = blockEnd + 2;
  const h2 = h1 + 1;
  const head = { bold: true, fill: FILL.header, border: true, h: "center" as const, size: 8 };
  put(ws, h1, 1, h1, 1, "เวลา", head);
  put(ws, h2, 1, h2, 1, "วัน/คาบ", head);
  if (hasPre) {
    put(ws, h1, 2, h1, 2, `${grid.preActivity!.start} - ${grid.preActivity!.end}`, { ...head, bold: false, size: 7 });
    put(ws, h2, 2, h2, 2, null, head);
  }
  grid.periods.forEach((p, i) => {
    put(ws, h1, first + i, h1, first + i, `${p.start} - ${p.end}`, { ...head, bold: false });
    put(ws, h2, first + i, h2, first + i, p.no, head);
  });
  ws.getRow(h1).height = 24;

  let rr = h2 + 1;
  const dayStart = rr;
  for (const row of grid.rows) {
    put(ws, rr, 1, rr, 1, row.day.label, { bold: true, border: true, h: "center" });
    let maxLines = 1;
    for (const c of row.cells) {
      const v = cellValue(c, grid);
      maxLines = Math.max(maxLines, v ? v.split("\n").length : 1);
      const fill = c.conflict ? FILL.conflict : c.state === "activity" ? FILL.activity : c.state === "break" ? FILL.break : undefined;
      const col = first + c.startPeriod - 1;
      put(ws, rr, col, rr, col + c.span - 1, v, { border: true, h: "center", size: 8, fill, bold: c.state === "activity" });
    }
    ws.getRow(rr).height = Math.max(42, maxLines * 11 + 4);
    rr++;
  }
  const dayEnd = rr - 1;
  if (hasPre && grid.rows.length) {
    put(ws, dayStart, 2, dayEnd, 2, grid.preActivity!.label, { bold: true, border: true, h: "center", rotate: 90, size: 9 });
  }

  // ลายเซ็น (เฉพาะตารางสอนครู)
  let last = dayEnd;
  if (grid.kind === "teacher" && school.signatories.length) {
    const sigs = school.signatories.slice(0, 4);
    const top = dayEnd + 3;
    const per = N / 4;
    sigs.forEach((s, i) => {
      const a = Math.round(i * per) + 1;
      const b = Math.round((i + 1) * per);
      put(ws, top, a, top, b, "ลงชื่อ........................................", { h: "center", wrap: false });
      put(ws, top + 1, a, top + 1, b, `(${s.name})`, { h: "center" });
      put(ws, top + 2, a, top + 2, b, s.title, { h: "center" });
    });
    last = top + 2;
  }

  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    printTitlesRow: `${h1}:${h2}`,
    printArea: `A1:${colLetter(N)}${last}`,
  };
  ws.views = [{ state: "normal", showGridLines: false, zoomScale: 90 }];
}

async function toBlob(wb: { xlsx: { writeBuffer(): Promise<ArrayBuffer | Uint8Array> } }): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as BlobPart], { type: XLSX_MIME });
}

function finalName(fileName: string): string {
  return safeFileName(fileName.toLowerCase().endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

/** Export ตาราง: 1 ชีตต่อ 1 ตาราง (เซลล์รวมตามคาบต่อเนื่อง, ตั้งค่าพิมพ์ A4 แนวนอน) */
export async function exportTimetableExcel(
  grids: TimetableGrid[],
  opts: { school: SchoolInfo; fileName: string; download?: boolean },
): Promise<Blob> {
  if (grids.length === 0) throw new Error("ไม่มีตารางให้ส่งออก");
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Learning Table";
  wb.created = new Date();
  const used = new Set<string>();
  for (const g of grids) {
    const ws = wb.addWorksheet(makeSheetName(g.title, used));
    writeTimetableSheet(ws, g, opts.school);
  }
  const blob = await toBlob(wb);
  if (opts.download) downloadBlob(blob, finalName(opts.fileName));
  return blob;
}

function textLen(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  // ไม่นับสระบน/ล่างและวรรณยุกต์ (ไม่กินความกว้าง)
  return String(v).replace(/[ัิ-ฺ็-๎]/g, "").length;
}

/** Export รายงาน: 1 ชีตต่อ 1 รายงาน (ตัวเลขเป็นตัวเลขจริง, ตรึงหัวตาราง, ตัวกรอง) */
export async function exportReportExcel(reports: ReportTable[], opts: { fileName: string; download?: boolean }): Promise<Blob> {
  if (reports.length === 0) throw new Error("ไม่มีรายงานให้ส่งออก");
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Learning Table";
  wb.created = new Date();
  const used = new Set<string>();
  for (const rep of reports) {
    const ws = wb.addWorksheet(makeSheetName(rep.title, used));
    const n = Math.max(1, rep.columns.length);
    put(ws, 1, 1, 1, n, rep.title, { bold: true, size: 13, wrap: false });
    let hr = 2;
    if (rep.subtitle) {
      put(ws, 2, 1, 2, n, rep.subtitle, { size: 9, wrap: false });
      hr = 3;
    }
    rep.columns.forEach((c, i) => {
      put(ws, hr, i + 1, hr, i + 1, c.label, { bold: true, fill: "FFE5E7EB", border: true, h: "center" });
      const longest = Math.max(textLen(c.label), ...rep.rows.slice(0, 500).map((r) => textLen(r[c.key])));
      ws.getColumn(i + 1).width = c.width ? Math.max(c.width, 6) : Math.min(60, Math.max(8, longest + 2));
    });
    ws.getRow(hr).height = 30;
    rep.rows.forEach((row, ri) => {
      const r = hr + 1 + ri;
      rep.columns.forEach((c, ci) => {
        const raw = row[c.key];
        let v: string | number | null = raw === undefined ? null : raw;
        if (c.numeric && typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) v = Number(v);
        const cell = ws.getCell(r, ci + 1);
        cell.value = v;
        style(cell, { border: true, h: c.align ?? (typeof v === "number" ? "right" : "left"), v: "top", wrap: true });
        if (typeof v === "number" && !Number.isInteger(v)) cell.numFmt = "0.0";
      });
    });
    const lastRow = hr + rep.rows.length;
    if (rep.footnote) put(ws, lastRow + 2, 1, lastRow + 2, n, rep.footnote, { size: 8, wrap: true });
    ws.views = [{ state: "frozen", ySplit: hr, xSplit: 0, topLeftCell: `A${hr + 1}`, activeCell: `A${hr + 1}` }];
    ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: Math.max(hr, lastRow), column: n } };
    ws.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: `${hr}:${hr}`,
    };
    ws.headerFooter = { oddFooter: "&Lพิมพ์จากระบบจัดตาราง&Rหน้า &P/&N" };
  }
  const blob = await toBlob(wb);
  if (opts.download) downloadBlob(blob, finalName(opts.fileName));
  return blob;
}
