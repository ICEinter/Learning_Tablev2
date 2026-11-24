/**
 * อ่านไฟล์นำเข้า (.csv / .xlsx) เป็นตารางข้อความ — ทำงานได้ทั้งในเบราว์เซอร์และ Node
 */
import type { ImportSpec } from "./specs";
import { matchColumns } from "./specs";

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  /** เลขแถวจริงในชีต (1-based รวมแถวหัว) ของแต่ละแถวใน rows — มีเมื่อมีการข้ามแถวว่าง */
  rowNumbers?: number[];
}

/** แยกข้อความ CSV (RFC 4180: quoted fields, "" escape, CRLF/LF/CR, newline ใน quote) */
export function parseCsvText(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delim = delimiter ?? detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === "") {
      field = "";
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delim) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (ch === "\r" && src[i + 1] === "\n") i++;
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (inQuotes) throw new Error("ไฟล์ CSV ไม่ถูกต้อง: เครื่องหมายคำพูด (\") ไม่ครบคู่");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text: string): string {
  // ดูเฉพาะบรรทัดแรก (นอกเครื่องหมายคำพูด)
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQ = false;
  for (const ch of text) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && (ch === "\n" || ch === "\r")) break;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  let best = ",";
  for (const d of [";", "\t"]) if (counts[d] > counts[best]) best = d;
  return best;
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // ไฟล์ที่บันทึกจาก Excel รุ่นเก่าอาจเป็น TIS-620 / Windows-874
    try {
      return new TextDecoder("windows-874").decode(bytes);
    } catch {
      throw new Error("อ่านไฟล์ CSV ไม่ได้: กรุณาบันทึกเป็น CSV UTF-8");
    }
  }
}

function isRowEmpty(r: string[]): boolean {
  return r.every((c) => (c ?? "").trim() === "");
}

/** ตัดแถวว่าง เติมคอลัมน์ให้เท่ากับหัวตาราง และจดเลขแถวจริง */
export function toParsedSheet(table: { rowNumber: number; cells: string[] }[]): ParsedSheet {
  const nonEmpty = table.filter((r) => !isRowEmpty(r.cells));
  if (nonEmpty.length === 0) throw new Error("ไฟล์ว่าง: ไม่พบข้อมูล");
  const [head, ...body] = nonEmpty;
  const headers = head.cells.map((h) => (h ?? "").replace(/^﻿/, "").trim());
  while (headers.length && headers[headers.length - 1] === "") headers.pop();
  if (headers.length === 0) throw new Error("ไม่พบแถวหัวคอลัมน์");
  const width = Math.max(headers.length, ...body.map((r) => r.cells.length));
  while (headers.length < width) headers.push("");
  const rows = body.map((r) => {
    const cells = r.cells.map((c) => (c ?? "").trim());
    while (cells.length < width) cells.push("");
    return cells;
  });
  return { headers, rows, rowNumbers: body.map((r) => r.rowNumber) };
}

function excelCellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toPrecision(12)));
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = value;
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const hasTime = d.getUTCHours() || d.getUTCMinutes();
    // Excel เก็บเวลาอย่างเดียวเป็นวันที่ 1899-12-30
    if (d.getUTCFullYear() <= 1900 && hasTime) return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    return hasTime ? `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : date;
  }
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text?: string }[]).map((t) => t.text ?? "").join("");
    if ("result" in v) return excelCellToString(v.result);
    if ("formula" in v || "sharedFormula" in v) return "";
    if ("text" in v) return excelCellToString(v.text);
    if ("error" in v) return "";
  }
  return String(value);
}

type ExcelJsModule = typeof import("exceljs");

/** โหลด exceljs แบบ dynamic (ไม่รันตอนโหลดโมดูลฝั่ง SSR) */
export async function loadExcelJs(): Promise<ExcelJsModule> {
  const mod = (await import("exceljs")) as unknown as ExcelJsModule & { default?: ExcelJsModule };
  return (mod.default && "Workbook" in mod.default ? mod.default : mod) as ExcelJsModule;
}

async function parseXlsx(data: ArrayBuffer): Promise<ParsedSheet> {
  const bytes = new Uint8Array(data);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("ไฟล์ Excel เสียหายหรือไม่ใช่ไฟล์ .xlsx");
  }
  const ExcelJS = await loadExcelJs();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    throw new Error("ไฟล์ Excel เสียหายหรือไม่ใช่ไฟล์ .xlsx");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("ไม่พบชีตในไฟล์ Excel");
  const table: { rowNumber: number; cells: string[] }[] = [];
  const colCount = ws.columnCount;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let c = 1; c <= colCount; c++) cells.push(excelCellToString(row.getCell(c).value).trim());
    table.push({ rowNumber, cells });
  });
  return toParsedSheet(table);
}

function parseCsv(data: ArrayBuffer): ParsedSheet {
  const text = decodeText(new Uint8Array(data));
  const rows = parseCsvText(text);
  return toParsedSheet(rows.map((cells, i) => ({ rowNumber: i + 1, cells })));
}

/** อ่านไฟล์นำเข้า: .csv (UTF-8 มี/ไม่มี BOM) หรือ .xlsx (ชีตแรก) */
export async function parseImportFile(data: ArrayBuffer, fileName: string): Promise<ParsedSheet> {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!data || data.byteLength === 0) throw new Error("ไฟล์ว่าง: ไม่พบข้อมูล");
  if (ext === "csv" || ext === "txt") return parseCsv(data);
  if (ext === "xlsx" || ext === "xlsm") return parseXlsx(data);
  if (ext === "xls") throw new Error("ไม่รองรับไฟล์ .xls (Excel 97-2003) กรุณาบันทึกเป็น .xlsx หรือ .csv");
  throw new Error(`ไม่รองรับไฟล์ชนิด .${ext || "?"} — รองรับเฉพาะ .xlsx และ .csv`);
}

/** จับคู่คอลัมน์อัตโนมัติจากชื่อหัวคอลัมน์ (ไม่สนตัวพิมพ์/ช่องว่าง และยอมรับชื่อ key) */
export function autoMapColumns(spec: ImportSpec, headers: string[]): Record<string, number | null> {
  return matchColumns(spec, headers);
}
