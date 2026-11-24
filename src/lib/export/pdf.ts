/**
 * Export PDF ด้วย pdfmake 0.3.x (ทำงานในเบราว์เซอร์ และทดสอบใน Node ได้)
 *
 * - โหลด pdfmake แบบ dynamic import ภายในฟังก์ชัน (ไม่รันตอนโหลดโมดูลฝั่ง SSR)
 * - ฟอนต์ Sarabun: เบราว์เซอร์ fetch("/fonts/...") ; Node/ทดสอบ ส่งข้อมูลฟอนต์ผ่าน setPdfFontLoader()
 *   (โมดูลนี้ไม่ import node:fs เพื่อไม่ให้ติดไปกับ bundle ฝั่งเบราว์เซอร์)
 * - ตัดบรรทัดภาษาไทยด้วยการตัดคำ + วัดความกว้างเอง (ดู thai-text.ts)
 */
import type { Content, ContentTable, CustomTableLayout, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { SchoolInfo } from "@/shared/types";
import type { GridCell, TimetableGrid } from "@/lib/timetable/viewmodel";
import type { ReportTable } from "@/lib/reports/types";
import { downloadBlob, safeFileName } from "./download";
import { textWidth, wrapText } from "./thai-text";

export type PdfOutput = "download" | "open" | "print" | "blob";

export interface PdfFontData {
  regular: ArrayBuffer | Uint8Array;
  bold: ArrayBuffer | Uint8Array;
}

export type PdfFontLoader = () => Promise<PdfFontData>;

const FONT_FILES = { regular: "Sarabun-Regular.ttf", bold: "Sarabun-Bold.ttf" } as const;

async function browserFontLoader(): Promise<PdfFontData> {
  const get = async (f: string) => {
    const res = await fetch(`/fonts/${f}`);
    if (!res.ok) throw new Error(`โหลดฟอนต์ ${f} ไม่สำเร็จ (${res.status})`);
    return res.arrayBuffer();
  };
  const [regular, bold] = await Promise.all([get(FONT_FILES.regular), get(FONT_FILES.bold)]);
  return { regular, bold };
}

let fontLoader: PdfFontLoader = browserFontLoader;
let pdfMakePromise: Promise<PdfMakeLike> | null = null;

/** เปลี่ยนวิธีโหลดฟอนต์ (เช่น อ่านจากดิสก์ใน Node/ทดสอบ) ; null = กลับไปใช้ fetch ของเบราว์เซอร์ */
export function setPdfFontLoader(loader: PdfFontLoader | null): void {
  fontLoader = loader ?? browserFontLoader;
  pdfMakePromise = null;
}

interface CreatedPdf {
  getBuffer(): Promise<Uint8Array>;
}

interface PdfMakeLike {
  createPdf(doc: TDocumentDefinitions): CreatedPdf;
  addFonts(fonts: Record<string, Record<string, string>>): void;
  addVirtualFileSystem?: (vfs: Record<string, string>) => void;
  sharedVirtualfs?: { writeFileSync(name: string, content: unknown): void };
  setUrlAccessPolicy?: (cb: (url: string) => boolean) => void;
  setLocalAccessPolicy?: (cb: (path: string) => boolean) => void;
}

function toU8(d: ArrayBuffer | Uint8Array): Uint8Array {
  return d instanceof Uint8Array ? d : new Uint8Array(d);
}

function toBase64(u8: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) s += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  return btoa(s);
}

async function getPdfMake(): Promise<PdfMakeLike> {
  if (!pdfMakePromise) {
    pdfMakePromise = (async () => {
      const mod = (await import("pdfmake")) as unknown as { default?: PdfMakeLike } & PdfMakeLike;
      const pm: PdfMakeLike = mod.default && typeof mod.default.createPdf === "function" ? mod.default : mod;
      const fonts = await fontLoader();
      const reg = toU8(fonts.regular);
      const bold = toU8(fonts.bold);
      if (typeof pm.addVirtualFileSystem === "function") {
        // build สำหรับเบราว์เซอร์
        pm.addVirtualFileSystem({ [FONT_FILES.regular]: toBase64(reg), [FONT_FILES.bold]: toBase64(bold) });
      } else if (pm.sharedVirtualfs) {
        // build สำหรับ Node
        const B = (globalThis as unknown as { Buffer?: { from(u: Uint8Array): unknown } }).Buffer;
        pm.sharedVirtualfs.writeFileSync(FONT_FILES.regular, B ? B.from(reg) : reg);
        pm.sharedVirtualfs.writeFileSync(FONT_FILES.bold, B ? B.from(bold) : bold);
      } else {
        throw new Error("pdfmake ไม่รองรับการเพิ่มฟอนต์ในสภาพแวดล้อมนี้");
      }
      pm.addFonts({
        Sarabun: {
          normal: FONT_FILES.regular,
          bold: FONT_FILES.bold,
          italics: FONT_FILES.regular,
          bolditalics: FONT_FILES.bold,
        },
      });
      // ไม่อนุญาตให้เอกสารโหลดไฟล์/URL ภายนอก (ใช้เฉพาะ vfs)
      pm.setUrlAccessPolicy?.(() => false);
      pm.setLocalAccessPolicy?.(() => false);
      return pm;
    })().catch((e) => {
      pdfMakePromise = null;
      throw e;
    });
  }
  return pdfMakePromise;
}

/** สร้าง PDF เป็นไบต์ (ใช้ได้ทั้ง Node และเบราว์เซอร์) */
export async function renderPdf(doc: TDocumentDefinitions): Promise<Uint8Array> {
  const pm = await getPdfMake();
  const buf = await pm.createPdf(doc).getBuffer();
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function printBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
  };
  document.body.appendChild(iframe);
  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 120_000);
}

async function deliver(doc: TDocumentDefinitions, fileName: string, output: PdfOutput): Promise<Blob> {
  // เปิดหน้าต่างทันทีก่อน await (กัน popup blocker)
  const win = output === "open" && typeof window !== "undefined" ? window.open("", "_blank") : null;
  let bytes: Uint8Array;
  try {
    bytes = await renderPdf(doc);
  } catch (e) {
    win?.close();
    throw e;
  }
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  if (output === "blob" || typeof window === "undefined") return blob;
  const name = safeFileName(fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`);
  if (output === "download") downloadBlob(blob, name);
  else if (output === "print") printBlob(blob);
  else if (output === "open") {
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else downloadBlob(blob, name); // popup ถูกบล็อก → ดาวน์โหลดแทน
    setTimeout(() => URL.revokeObjectURL(url), 300_000);
  }
  return blob;
}

// ---------------------------------------------------------------------------
// Timetable layout
// ---------------------------------------------------------------------------

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN_X = 20;
const MARGIN_Y = 18;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_H = PAGE_H - MARGIN_Y * 2;
const LINE = 1.3; // ความสูงบรรทัดของ Sarabun ต่อขนาดฟอนต์ (ascent 1068 − descent −232)
const PAD = 2;
const BORDER = 0.5;

const COLORS = {
  activity: "#E5E7EB",
  break: "#F3F4F6",
  conflict: "#FDE2E2",
  header: "#F3F4F6",
  border: "#6B7280",
  muted: "#4B5563",
};

const gridLayout: CustomTableLayout = {
  hLineWidth: () => BORDER,
  vLineWidth: () => BORDER,
  hLineColor: () => COLORS.border,
  vLineColor: () => COLORS.border,
  paddingLeft: () => PAD,
  paddingRight: () => PAD,
  paddingTop: () => PAD,
  paddingBottom: () => PAD,
};

const VIEW_HEADING: Record<TimetableGrid["kind"], string> = {
  teacher: "ตารางสอน",
  group: "ตารางเรียน",
  student: "ตารางเรียน",
  room: "ตารางการใช้ห้อง",
  course: "ตารางรายวิชา",
};

function cellText(cell: GridCell, grid: TimetableGrid): string {
  if (cell.state === "break") return grid.periods[cell.startPeriod - 1]?.label ?? "พัก";
  if (cell.items.length === 0) return "";
  return cell.items.map((it) => it.lines.filter((l) => l && l.trim()).join("\n")).join("\n―\n");
}

function lines(text: string): number {
  return text ? text.split("\n").length : 0;
}

/** จัดหน้าให้ 1 ตาราง = 1 หน้า: ลองขนาดตัวอักษรจากใหญ่ไปเล็กจนพอดี */
export function buildTimetableContent(grid: TimetableGrid, school: SchoolInfo): Content[] {
  let last: { content: Content[]; fits: boolean } | null = null;
  for (const scale of [1, 0.92, 0.84, 0.76, 0.7]) {
    last = layoutTimetable(grid, school, scale);
    if (last.fits) break;
  }
  return last!.content;
}

function layoutTimetable(grid: TimetableGrid, school: SchoolInfo, scale: number): { content: Content[]; fits: boolean } {
  const P = grid.periods.length;
  const days = grid.rows.length;
  const hasPre = Boolean(grid.preActivity);
  const FS = 6.5 * scale;
  const lh = FS * LINE;

  // ---- header block (ซ้าย: ข้อมูล, ขวา: สรุปรายวิชา) ----
  const LEFT_W = 290;
  const GAP = 10;
  const RIGHT_W = CONTENT_W - LEFT_W - GAP;
  const metaLabelW = 62;
  const metaValueW = LEFT_W - metaLabelW - 4 * PAD - 2;
  const metaFs = Math.max(6, 8 * scale);
  const metaRows: TableCell[][] = grid.meta.map((m) => [
    { text: wrapText(m.label, metaLabelW, metaFs, true), bold: true, fontSize: metaFs },
    { text: wrapText(m.value, metaValueW, metaFs), fontSize: metaFs },
  ]);
  const left = {
    width: LEFT_W,
    stack: [
      { text: wrapText(school.name, LEFT_W, 11, true), bold: true, fontSize: 11 },
      { text: VIEW_HEADING[grid.kind], bold: true, fontSize: 10, margin: [0, 1, 0, 2] },
      {
        table: { widths: [metaLabelW, "*"], body: metaRows.length ? metaRows : [["", ""]] },
        layout: { ...gridLayout, hLineWidth: () => 0, vLineWidth: () => 0 },
      },
    ],
  };

  const sFs = 7 * scale;
  const codeW = 58;
  const numW = 18;
  const nameW = RIGHT_W - codeW - numW * 4 - 6 * (2 * PAD) - 7 * BORDER;
  const num = (n: number | null) => (n === null || n === undefined ? "" : String(n));
  const sumBody: TableCell[][] = [
    ["รหัสวิชา", "ชื่อรายวิชา", "ท.", "ป.", "น.", "ช."].map((t) => ({ text: t, bold: true, alignment: "center", fillColor: COLORS.header })),
    ...grid.summary.map((r) => [
      { text: wrapText(r.code, codeW, sFs), fillColor: r.isActivity ? COLORS.activity : undefined },
      { text: wrapText(r.name, nameW, sFs), fillColor: r.isActivity ? COLORS.activity : undefined },
      { text: num(r.theory), alignment: "center" },
      { text: num(r.practice), alignment: "center" },
      { text: num(r.credits), alignment: "center" },
      { text: String(r.hours), alignment: "center" },
    ] as TableCell[]),
    [
      { text: "รวม", bold: true, alignment: "right", colSpan: 2 },
      {},
      { text: String(grid.totals.theory), bold: true, alignment: "center" },
      { text: String(grid.totals.practice), bold: true, alignment: "center" },
      { text: String(grid.totals.credits), bold: true, alignment: "center" },
      { text: String(grid.totals.hours), bold: true, alignment: "center" },
    ],
    [
      { text: `(รวมใน: ${grid.stats.inRegular}) (รวมนอก: ${grid.stats.outRegular})`, alignment: "right", colSpan: 6, fontSize: sFs },
      {},
      {},
      {},
      {},
      {},
    ],
  ];
  const right = {
    width: "*",
    table: { headerRows: 1, widths: [codeW, "*", numW, numW, numW, numW], body: sumBody },
    layout: gridLayout,
    fontSize: sFs,
  };

  // ---- grid ----
  const dayW = 52;
  const preW = hasPre ? 34 : 0;
  const nCols = P + 1 + (hasPre ? 1 : 0);
  const extras = nCols * 2 * PAD + (nCols + 1) * BORDER;
  const periodW = (CONTENT_W - dayW - preW - extras) / P;
  const spanW = (span: number) => span * periodW + (span - 1) * (2 * PAD + BORDER);

  const hdrFs = Math.max(5.5, 6.5 * scale);
  const head1: TableCell[] = [
    { text: "เวลา", bold: true, alignment: "center", fillColor: COLORS.header, fontSize: 7 },
    ...(hasPre
      ? [{ text: wrapText(`${grid.preActivity!.start} - ${grid.preActivity!.end}`, preW, 6), alignment: "center", fillColor: COLORS.header, fontSize: 6 } as TableCell]
      : []),
    ...grid.periods.map(
      (p) => ({ text: wrapText(`${p.start} - ${p.end}`, periodW, hdrFs), alignment: "center", fillColor: COLORS.header, fontSize: hdrFs }) as TableCell,
    ),
  ];
  const head2: TableCell[] = [
    { text: "วัน/คาบ", bold: true, alignment: "center", fillColor: COLORS.header, fontSize: 7 },
    ...(hasPre ? [{ text: "", fillColor: COLORS.header } as TableCell] : []),
    ...grid.periods.map((p) => ({ text: String(p.no), bold: true, alignment: "center", fillColor: COLORS.header, fontSize: 7 }) as TableCell),
  ];

  // ข้อความแต่ละช่อง (ตัดบรรทัดแล้ว) + ความสูงแถว
  const rowTexts = grid.rows.map((r) => r.cells.map((c) => wrapText(cellText(c, grid), spanW(c.span), FS)));
  const neededRow = rowTexts.map((ts) => Math.max(1, ...ts.map(lines)) * lh + 2 * PAD);

  // ประมาณความสูงส่วนอื่นเพื่อให้ 1 ตาราง = 1 หน้า
  const leftH = 11 * LINE + 10 * LINE + 3 + grid.meta.reduce((s, m) => s + lines(wrapText(m.value, metaValueW, metaFs)) * metaFs * LINE + 2 * PAD, 0);
  const rightH = (grid.summary.length + 3) * (sFs * LINE + 2 * PAD) + grid.summary.reduce((s, r) => s + (lines(wrapText(r.name, nameW, sFs)) - 1) * sFs * LINE, 0);
  const headerH = Math.max(leftH, rightH) + 8;
  const gridHeadH = 2 * (hdrFs * LINE * 2 + 2 * PAD);
  const sigFs = Math.max(6.5, 8 * scale);
  const sigMargin = 18 * scale;
  const hasSig = grid.kind === "teacher" && school.signatories.length > 0;
  const sigH = hasSig ? sigMargin + 2 + 3 * sigFs * LINE + 4 : 0;
  const statsH = 6.5 * LINE + 3 + 2;
  const availForRows = (CONTENT_H - headerH - gridHeadH - sigH - statsH - 10) * 0.97 - (days + 1) * BORDER;
  const neededSum = neededRow.reduce((s, h) => s + h, 0);
  const fits = neededSum <= availForRows;
  // แถวสูงเท่ากันเท่าที่ทำได้ (ไม่เกิน 44pt) แต่ไม่ต่ำกว่าความสูงที่ข้อความต้องการ
  let lo = 0;
  let hi = 44;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    const sum = neededRow.reduce((s, h) => s + Math.max(h, mid), 0);
    if (sum <= availForRows) lo = mid;
    else hi = mid;
  }
  const rowHeights = neededRow.map((h) => Math.max(h, lo));

  const preText = hasPre ? wrapText(grid.preActivity!.label, preW, 7, true) : "";
  const body: TableCell[][] = [head1, head2];
  grid.rows.forEach((r, ri) => {
    const row: TableCell[] = [{ text: r.day.label, bold: true, alignment: "center", verticalAlignment: "middle", fontSize: 7.5 } as TableCell];
    if (hasPre) {
      if (ri === 0)
        row.push({ text: preText, rowSpan: days, bold: true, alignment: "center", verticalAlignment: "middle", fontSize: 7 } as TableCell);
      else row.push({});
    }
    r.cells.forEach((c, ci) => {
      const fill =
        c.conflict ? COLORS.conflict : c.state === "activity" ? COLORS.activity : c.state === "break" ? COLORS.break : undefined;
      const cell: Record<string, unknown> = {
        text: rowTexts[ri][ci],
        alignment: "center",
        verticalAlignment: "middle",
        fontSize: FS,
      };
      if (fill) cell.fillColor = fill;
      if (c.span > 1) cell.colSpan = c.span;
      if (c.state === "activity") cell.bold = true;
      row.push(cell as TableCell);
      for (let k = 1; k < c.span; k++) row.push({});
    });
    body.push(row);
  });

  const gridTable: ContentTable = {
    table: {
      headerRows: 2,
      dontBreakRows: true,
      widths: [dayW, ...(hasPre ? [preW] : []), ...Array.from({ length: P }, () => "*" as const)],
      heights: (i: number) => (i < 2 ? "auto" : rowHeights[i - 2] - 2 * PAD),
      body,
    },
    layout: gridLayout,
    margin: [0, 6, 0, 0],
  } as ContentTable;

  const st = grid.stats;
  const statsLine: Content = {
    text: `คาบสอน ${st.teachingPeriods} คาบ · กิจกรรม ${st.activityPeriods} คาบ · คาบว่างคั่น ${st.freePeriods} คาบ · คาบต่อเนื่อง ${st.consecutiveBlocks} ช่วง · สูงสุด ${st.maxPerDay} คาบ/วัน`,
    fontSize: 6.5,
    color: COLORS.muted,
    margin: [0, 3, 0, 0],
  };

  const out: Content[] = [{ columns: [left, right] as Content[], columnGap: GAP }, gridTable, statsLine];

  if (hasSig) {
    const sigs = school.signatories.slice(0, 4);
    const colW = CONTENT_W / 4;
    out.push({
      columns: Array.from({ length: 4 }, (_, i) => {
        const s = sigs[i];
        if (!s) return { width: "*", text: "" };
        return {
          width: "*",
          stack: [
            { text: "ลงชื่อ......................................................", alignment: "center" },
            { text: wrapText(`(${s.name})`, colW - 8, sigFs), alignment: "center", margin: [0, 2, 0, 0] },
            { text: wrapText(s.title, colW - 8, sigFs), alignment: "center" },
          ],
        } as Content;
      }),
      columnGap: 8,
      fontSize: sigFs,
      margin: [0, sigMargin, 0, 0],
      unbreakable: true,
    } as Content);
  }
  return { content: out, fits };
}

export function buildTimetableDocDefinition(grids: TimetableGrid[], school: SchoolInfo, title = "ตารางสอน"): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [MARGIN_X, MARGIN_Y, MARGIN_X, MARGIN_Y],
    info: { title, creator: "Learning Table", producer: "pdfmake" },
    defaultStyle: { font: "Sarabun", fontSize: 7, lineHeight: 1 },
    content: grids.map((g, i) => ({
      stack: buildTimetableContent(g, school),
      ...(i > 0 ? { pageBreak: "before" as const } : {}),
    })),
  };
}

/** Export ตาราง (1 หน้า A4 แนวนอน ต่อ 1 ตาราง) */
export async function exportTimetablePdf(
  grids: TimetableGrid[],
  opts: { school: SchoolInfo; fileName: string; output?: PdfOutput },
): Promise<Blob | void> {
  if (grids.length === 0) throw new Error("ไม่มีตารางให้ส่งออก");
  const doc = buildTimetableDocDefinition(grids, opts.school, grids.length === 1 ? `${VIEW_HEADING[grids[0].kind]} ${grids[0].title}` : "ตาราง");
  return deliver(doc, opts.fileName, opts.output ?? "download");
}

// ---------------------------------------------------------------------------
// Report layout
// ---------------------------------------------------------------------------

const R_MARGIN_X = 24;
const R_CONTENT_W = PAGE_W - R_MARGIN_X * 2;
const R_PAD = 3;

function formatValue(v: string | number | undefined, numeric?: boolean): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(v);
  return numeric ? v : String(v);
}

/** คำนวณความกว้างคอลัมน์ (pt) ให้พอดีหน้ากระดาษเสมอ — ไม่มีคอลัมน์ถูกตัด */
export function reportColumnWidths(report: ReportTable, totalWidth = R_CONTENT_W, fontSize = 7.5): number[] {
  const n = report.columns.length;
  const extras = n * 2 * R_PAD + (n + 1) * BORDER;
  const avail = totalWidth - extras;
  const natural = report.columns.map((c) => {
    if (c.width) return c.width;
    const sample = report.rows.slice(0, 200).map((r) => formatValue(r[c.key], c.numeric));
    const longest = Math.max(textWidth(c.label, fontSize, true), ...sample.map((s) => textWidth(s, fontSize)));
    return Math.min(60, Math.max(4, longest / (fontSize * 0.55)));
  });
  // ขั้นต่ำ: คอลัมน์ต้องกว้างพอสำหรับคำที่ยาวที่สุดในหัวคอลัมน์ / ตัวเลข
  const minW = report.columns.map((c) => {
    const nums = c.numeric ? report.rows.map((r) => textWidth(formatValue(r[c.key], true), fontSize)) : [];
    return Math.max(fontSize * 2, ...nums);
  });
  const sum = natural.reduce((s, x) => s + x, 0);
  const widths = natural.map((x, i) => Math.max(minW[i], (x / sum) * avail));
  const total = widths.reduce((s, x) => s + x, 0);
  if (total > avail) {
    // ลดเฉพาะคอลัมน์ที่เกินขั้นต่ำ
    const flex = widths.reduce((s, w, i) => s + (w - minW[i]), 0);
    const over = total - avail;
    return widths.map((w, i) => w - (flex > 0 ? ((w - minW[i]) / flex) * over : over / n));
  }
  return widths;
}

const reportLayout: CustomTableLayout = {
  hLineWidth: () => BORDER,
  vLineWidth: () => BORDER,
  hLineColor: () => "#9CA3AF",
  vLineColor: () => "#9CA3AF",
  paddingLeft: () => R_PAD,
  paddingRight: () => R_PAD,
  paddingTop: () => 2,
  paddingBottom: () => 2,
  fillColor: (rowIndex: number) => (rowIndex === 0 ? "#E5E7EB" : rowIndex % 2 === 0 ? "#F9FAFB" : null),
};

export function buildReportDocDefinition(
  reports: ReportTable[],
  opts: { school: SchoolInfo; termLabel: string },
): TDocumentDefinitions {
  const FS = 7.5;
  const content: Content[] = [];
  reports.forEach((rep, ri) => {
    const widths = reportColumnWidths(rep, R_CONTENT_W, FS);
    const header: TableCell[] = rep.columns.map((c, i) => ({
      text: wrapText(c.label, widths[i], FS, true),
      bold: true,
      alignment: "center",
      verticalAlignment: "middle",
    }) as TableCell);
    const body: TableCell[][] = [
      header,
      ...rep.rows.map((r) =>
        rep.columns.map((c, i) => ({
          text: wrapText(formatValue(r[c.key], c.numeric), widths[i], FS),
          alignment: c.align ?? (c.numeric ? "right" : "left"),
        }) as TableCell),
      ),
    ];
    if (rep.rows.length === 0)
      body.push([{ text: "ไม่มีข้อมูล", colSpan: rep.columns.length, alignment: "center", color: COLORS.muted } as TableCell, ...rep.columns.slice(1).map(() => ({}))]);
    content.push({
      stack: [
        { text: rep.title, bold: true, fontSize: 13 },
        ...(rep.subtitle ? [{ text: wrapText(rep.subtitle, R_CONTENT_W, 9), fontSize: 9, color: COLORS.muted } as Content] : []),
        {
          table: { headerRows: 1, dontBreakRows: true, keepWithHeaderRows: 1, widths, body },
          layout: reportLayout,
          fontSize: FS,
          margin: [0, 6, 0, 0],
        } as ContentTable,
        ...(rep.footnote ? [{ text: wrapText(rep.footnote, R_CONTENT_W, 7), fontSize: 7, color: COLORS.muted, margin: [0, 4, 0, 0] } as Content] : []),
      ],
      ...(ri > 0 ? { pageBreak: "before" as const } : {}),
    });
  });
  const printed = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [R_MARGIN_X, 40, R_MARGIN_X, 30],
    info: { title: reports.map((r) => r.title).join(", "), creator: "Learning Table" },
    defaultStyle: { font: "Sarabun", fontSize: FS, lineHeight: 1 },
    header: () => ({
      margin: [R_MARGIN_X, 16, R_MARGIN_X, 0],
      columns: [
        { text: wrapText(opts.school.name, R_CONTENT_W * 0.6, 9, true), bold: true, fontSize: 9 },
        { text: `ภาคเรียน ${opts.termLabel}`, alignment: "right", fontSize: 8, color: COLORS.muted },
      ],
    }),
    footer: (page: number, pages: number) => ({
      margin: [R_MARGIN_X, 8, R_MARGIN_X, 0],
      columns: [
        { text: `พิมพ์เมื่อ ${printed}`, fontSize: 7, color: COLORS.muted },
        { text: `หน้า ${page}/${pages}`, alignment: "right", fontSize: 7, color: COLORS.muted },
      ],
    }),
    content,
  };
}

/** Export รายงาน (A4 แนวนอน หัวตารางซ้ำทุกหน้า) */
export async function exportReportPdf(
  reports: ReportTable[],
  opts: { school: SchoolInfo; termLabel: string; fileName: string; output?: PdfOutput },
): Promise<Blob | void> {
  if (reports.length === 0) throw new Error("ไม่มีรายงานให้ส่งออก");
  const doc = buildReportDocDefinition(reports, opts);
  return deliver(doc, opts.fileName, opts.output ?? "download");
}
