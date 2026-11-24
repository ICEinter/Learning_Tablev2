import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createMockDataset } from "@/data/mock";
import { exportReportExcel, exportTimetableExcel, makeSheetName } from "@/lib/export/excel";
import { placementListReport, roomUtilizationReport, teacherLoadReport } from "@/lib/reports/reports";
import { buildGrid } from "@/lib/timetable/viewmodel";
import { mockPlacements } from "./fixtures";

const ds = createMockDataset();
const placements = mockPlacements();

async function load(blob: Blob) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb;
}

function findRow(ws: ExcelJS.Worksheet, col: number, value: string): number {
  for (let r = 1; r <= ws.rowCount; r++) if (ws.getCell(r, col).value === value) return r;
  return -1;
}

describe("makeSheetName", () => {
  it("strips invalid chars, truncates to 31 and de-duplicates", () => {
    const used = new Set<string>();
    expect(makeSheetName("a[b]:c*d?e/f\\g", used)).toBe("a b c d e f g");
    const long = "ก".repeat(40);
    const n1 = makeSheetName(long, used);
    const n2 = makeSheetName(long, used);
    expect(n1.length).toBe(31);
    expect(n2.length).toBeLessThanOrEqual(31);
    expect(n2.endsWith(" (2)")).toBe(true);
    expect(makeSheetName("", used)).toBe("Sheet");
  });
});

describe("exportTimetableExcel", () => {
  it("one sheet per grid with real values, merges, print setup", async () => {
    const grids = [
      buildGrid(ds, placements, "teacher", "t05"),
      buildGrid(ds, placements, "group", "g-sit11"),
      buildGrid(ds, placements, "room", "r-it1"),
    ];
    const blob = await exportTimetableExcel(grids, { school: ds.school, fileName: "t.xlsx" });
    expect(blob.size).toBeGreaterThan(1000);
    const wb = await load(blob);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["นายปกรณ์ วงศ์สวัสดิ์", "สIT.1 1 ปวส.1 เทคโนโลยีสารสนเทศ", "ห้องปฏิบัติการคอมพิวเตอร์ IT1"]);

    const ws = wb.worksheets[0];
    expect(ws.getCell("A1").value).toBe("ตารางสอน นายปกรณ์ วงศ์สวัสดิ์");
    expect(ws.getCell("A2").value).toBe(ds.school.name);
    // meta block
    expect(findRow(ws, 1, "ผู้สอน")).toBeGreaterThan(0);
    // summary
    const sumHead = findRow(ws, 6, "รหัสวิชา");
    expect(sumHead).toBeGreaterThan(0);
    const sumCodes: string[] = [];
    for (let r = sumHead + 1; r < sumHead + 20; r++) {
      const v = ws.getCell(r, 6).value;
      if (v === "รวม") break;
      sumCodes.push(String(v));
    }
    expect(sumCodes).toEqual(["30000-2002", "31901-2005", "31901-2008", "31906-2014", "Home Room", "PLC"]);
    const totalRow = findRow(ws, 6, "รวม");
    expect(ws.getCell(totalRow, 15).value).toBe(grids[0].totals.hours);
    expect(String(ws.getCell(totalRow + 1, 6).value)).toBe(`(รวมใน: ${grids[0].stats.inRegular}) (รวมนอก: ${grids[0].stats.outRegular})`);

    // grid header + day rows
    const h1 = findRow(ws, 1, "เวลา");
    expect(ws.getCell(h1, 2).value).toBe("08:00 - 08:30");
    expect(ws.getCell(h1, 3).value).toBe("08:30 - 09:30");
    expect(ws.getCell(h1 + 1, 1).value).toBe("วัน/คาบ");
    expect(ws.getCell(h1 + 1, 15).value).toBe(13);
    const mon = findRow(ws, 1, "วันจันทร์");
    expect(mon).toBe(h1 + 2);
    expect(findRow(ws, 1, "วันอาทิตย์")).toBe(mon + 6); // วันปิดยังแสดง
    expect(ws.getCell(mon, 2).value).toBe("กิจกรรมหน้าเสาธง");
    expect(ws.getCell(mon, 3).value).toBe("31901-2005\nIT1\nสIT.1/1 (17)");
    expect(ws.getCell(mon, 4).value).toBe("31901-2005\nIT1\nสIT.1/1 (17)");
    // วันพุธ คาบ 7 = Home Room (สีเทา)
    const wed = mon + 2;
    expect(String(ws.getCell(wed, 9).value)).toMatch(/^Home Room/);
    expect((ws.getCell(wed, 9).fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FFE5E7EB");

    const merges: string[] = (ws.model as unknown as { merges: string[] }).merges;
    expect(merges).toContain(`D${mon}:E${mon}`); // จ. คาบ 2–3 ต่อเนื่อง
    expect(merges).toContain(`B${mon}:B${mon + 6}`); // คอลัมน์กิจกรรมหน้าเสาธง
    expect(merges).toContain(`D${mon + 4}:G${mon + 4}`); // ศ. คาบ 2–5 (31906-2014)
    // ลายเซ็น 4 คน
    expect(findRow(ws, 1, "ลงชื่อ........................................")).toBeGreaterThan(mon + 6);
    expect(ws.pageSetup.orientation).toBe("landscape");
    expect(ws.pageSetup.paperSize).toBe(9);
    expect(ws.pageSetup.fitToWidth).toBe(1);
    expect(ws.pageSetup.printTitlesRow).toBe(`${h1}:${h1 + 1}`);
    // ตารางกลุ่มไม่มีลายเซ็น
    expect(findRow(wb.worksheets[1], 1, "ลงชื่อ........................................")).toBe(-1);
  });
});

describe("exportReportExcel", () => {
  it("one sheet per report; numbers are numbers; frozen header; autofilter", async () => {
    const reports = [teacherLoadReport(ds, placements), roomUtilizationReport(ds, placements), placementListReport(ds, placements)];
    const wb = await load(await exportReportExcel(reports, { fileName: "r" }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["รายงานภาระงานสอนรายบุคคล", "รายงานการใช้ห้อง", "ตารางรวม"]);
    const ws = wb.worksheets[0];
    expect(ws.getCell("A3").value).toBe("รหัส");
    expect(ws.getCell("A4").value).toBe("T001");
    expect(typeof ws.getCell("E4").value).toBe("number");
    const t05 = findRow(ws, 1, "T005");
    expect(ws.getCell(t05, 6).value).toBe(reports[0].rows.find((r) => r.code === "T005")!.scheduled);
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 3 });
    expect(ws.autoFilter).toBeTruthy();
    const room = wb.worksheets[1];
    expect(typeof room.getCell("G4").value).toBe("number");
    expect(wb.worksheets[2].rowCount).toBeGreaterThanOrEqual(3 + placements.length);
  });
});

describe("sample files", () => {
  it("writes docs/samples teacher timetable XLSX", async () => {
    const grids = [buildGrid(ds, placements, "teacher", "t05"), buildGrid(ds, placements, "group", "g-sit11")];
    const blob = await exportTimetableExcel(grids, { school: ds.school, fileName: "sample" });
    const dir = path.resolve(__dirname, "../../docs/samples");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "teacher-timetable-sample.xlsx"), new Uint8Array(await blob.arrayBuffer()));
    const rblob = await exportReportExcel([teacherLoadReport(ds, placements), placementListReport(ds, placements)], { fileName: "r" });
    writeFileSync(path.join(dir, "reports-sample.xlsx"), new Uint8Array(await rblob.arrayBuffer()));
  });
});
