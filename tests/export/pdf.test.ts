import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createMockDataset } from "@/data/mock";
import { buildReportDocDefinition, exportReportPdf, exportTimetablePdf, reportColumnWidths, setPdfFontLoader } from "@/lib/export/pdf";
import { lineCount, segmentWords, textWidth, wrapText } from "@/lib/export/thai-text";
import { placementListReport, teacherLoadReport } from "@/lib/reports/reports";
import type { ReportTable } from "@/lib/reports/types";
import { buildGrid } from "@/lib/timetable/viewmodel";
import type { ContentStack, ContentTable } from "pdfmake/interfaces";
import { mockPlacements } from "./fixtures";

const root = path.resolve(__dirname, "../..");
const ds = createMockDataset();
const placements = mockPlacements();

beforeAll(() => {
  setPdfFontLoader(async () => ({
    regular: readFileSync(path.join(root, "public/fonts/Sarabun-Regular.ttf")),
    bold: readFileSync(path.join(root, "public/fonts/Sarabun-Bold.ttf")),
  }));
});

function pdfText(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

function pageCount(bytes: Uint8Array): number {
  return (pdfText(bytes).match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}

async function toBytes(b: Blob | void): Promise<Uint8Array> {
  expect(b).toBeInstanceOf(Blob);
  return new Uint8Array(await (b as Blob).arrayBuffer());
}

describe("thai-text", () => {
  it("segments Thai words and wraps without splitting marks", () => {
    // ICU อาจแยก "เสาธง" เป็น "เสา|ธง" ได้ — ยอมรับทั้งสองแบบ
    expect(["กิจกรรม|หน้า|เสาธง", "กิจกรรม|หน้า|เสา|ธง"]).toContain(segmentWords("กิจกรรมหน้าเสาธง").join("|"));
    const w = wrapText("การพัฒนาซอฟต์แวร์รูปแบบเดฟออฟส์", 40, 7);
    for (const line of w.split("\n")) expect(textWidth(line, 7)).toBeLessThanOrEqual(40);
    expect(w.replace(/\n/g, "")).toBe("การพัฒนาซอฟต์แวร์รูปแบบเดฟออฟส์");
    // คำเดียวที่ยาวเกิน → ตัดตาม grapheme (ไม่มีบรรทัดที่ขึ้นต้นด้วยสระบน/วรรณยุกต์)
    const long = wrapText("ซอฟต์แวร์ซอฟต์แวร์", 15, 7);
    for (const line of long.split("\n")) expect(/^[ัิ-ฺ็-๎]/.test(line)).toBe(false);
    expect(lineCount("สั้น", 100, 7)).toBe(1);
    // ความกว้างตรงกับ fontkit: "กิจกรรมหน้าเสาธง ปวส." = 9661 units
    expect(textWidth("กิจกรรมหน้าเสาธง ปวส.", 1000)).toBe(9661);
  });
});

describe("exportTimetablePdf", () => {
  it("one A4 landscape page per grid, Thai font embedded", async () => {
    const grids = ds.teachers.map((t) => buildGrid(ds, placements, "teacher", t.id));
    grids.push(buildGrid(ds, placements, "group", "g-sit11"), buildGrid(ds, placements, "room", "r-it1"));
    const bytes = await toBytes(await exportTimetablePdf(grids, { school: ds.school, fileName: "x.pdf", output: "blob" }));
    const txt = pdfText(bytes);
    expect(txt.startsWith("%PDF")).toBe(true);
    expect(pageCount(bytes)).toBe(grids.length);
    expect(txt).toMatch(/\/BaseFont\s*\/[A-Z]{6}\+Sarabun-Regular/);
    expect(txt).toMatch(/\/BaseFont\s*\/[A-Z]{6}\+Sarabun-Bold/);
    expect(txt).toMatch(/\/FontFile2/);
    // A4 landscape
    expect(txt).toMatch(/\/MediaBox\s*\[0 0 841\.89\d* 595\.28\d*\]/);
  });
});

describe("exportTimetablePdf — dense grid", () => {
  it("still fits one page with a long course summary", async () => {
    const g = buildGrid(ds, placements, "teacher", "t05");
    const extra = Array.from({ length: 10 }, (_, i) => ({
      code: `31901-21${String(i).padStart(2, "0")}`,
      name: "รายวิชาทดสอบที่มีชื่อยาวมากเพื่อทดสอบการตัดบรรทัดภาษาไทยในตารางสรุป",
      theory: 1,
      practice: 3,
      credits: 2,
      hours: 4,
      isActivity: false,
    }));
    const dense = { ...g, summary: [...extra, ...g.summary] };
    const bytes = await toBytes(await exportTimetablePdf([dense], { school: ds.school, fileName: "d", output: "blob" }));
    expect(pageCount(bytes)).toBe(1);
  });
});

describe("exportReportPdf", () => {
  it("long report spans multiple pages with repeated header row", async () => {
    const base = placementListReport(ds, placements);
    const long: ReportTable = { ...base, rows: Array.from({ length: 12 }, () => base.rows).flat() };
    const doc = buildReportDocDefinition([long, teacherLoadReport(ds, placements)], { school: ds.school, termLabel: "2/2569" });
    const content = doc.content as ContentStack[];
    const table = content[0].stack.find((x) => typeof x === "object" && x !== null && "table" in x) as ContentTable;
    expect(table.table.headerRows).toBe(1);
    expect(table.table.dontBreakRows).toBe(true);
    // ความกว้างคอลัมน์รวมไม่เกินหน้ากระดาษ
    const widths = reportColumnWidths(long);
    const n = widths.length;
    expect(widths.reduce((s, w) => s + w, 0) + n * 6 + (n + 1) * 0.5).toBeLessThanOrEqual(841.89 - 48 + 0.01);

    const bytes = await toBytes(
      await exportReportPdf([long, teacherLoadReport(ds, placements)], { school: ds.school, termLabel: "2/2569", fileName: "r", output: "blob" }),
    );
    expect(pdfText(bytes).startsWith("%PDF")).toBe(true);
    expect(pageCount(bytes)).toBeGreaterThan(2);
  });

  it("writes sample PDFs to docs/samples", async () => {
    const dir = path.join(root, "docs/samples");
    mkdirSync(dir, { recursive: true });
    const grids = [buildGrid(ds, placements, "teacher", "t05"), buildGrid(ds, placements, "group", "g-sit11")];
    const tt = await toBytes(await exportTimetablePdf(grids, { school: ds.school, fileName: "s", output: "blob" }));
    writeFileSync(path.join(dir, "teacher-timetable-sample.pdf"), tt);
    const rp = await toBytes(
      await exportReportPdf([teacherLoadReport(ds, placements), placementListReport(ds, placements)], {
        school: ds.school,
        termLabel: "2/2569",
        fileName: "r",
        output: "blob",
      }),
    );
    writeFileSync(path.join(dir, "reports-sample.pdf"), rp);
    expect(pageCount(tt)).toBe(2);
  });
});
