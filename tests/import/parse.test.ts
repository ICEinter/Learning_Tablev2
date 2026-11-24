import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { autoMapColumns, parseCsvText, parseImportFile } from "@/lib/import/parse";
import { IMPORT_SPECS } from "@/lib/import/specs";
import { formatSlotList, parseSlotList } from "@/lib/import/slots-format";

const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe("parseCsvText / parseImportFile (CSV)", () => {
  it("handles BOM, quoted fields, escaped quotes, CRLF, embedded newlines and empty rows", async () => {
    const csv =
      "﻿รหัสวิชา,ชื่อรายวิชา,อุปกรณ์ที่ต้องใช้\r\n" +
      '31901-2008,"การพัฒนา ""DevOps""","คอมพิวเตอร์, GPU"\r\n' +
      ",,\r\n" +
      "\r\n" +
      '30000-1407,"บรรทัด1\nบรรทัด2",\r\n';
    const sheet = await parseImportFile(enc(csv), "x.csv");
    expect(sheet.headers).toEqual(["รหัสวิชา", "ชื่อรายวิชา", "อุปกรณ์ที่ต้องใช้"]);
    expect(sheet.rows).toEqual([
      ["31901-2008", 'การพัฒนา "DevOps"', "คอมพิวเตอร์, GPU"],
      ["30000-1407", "บรรทัด1\nบรรทัด2", ""],
    ]);
    // แถวว่าง (แถวที่ 3, 4) ถูกข้าม แต่เลขแถวจริงยังถูกต้อง
    expect(sheet.rowNumbers).toEqual([2, 5]);
  });

  it("works without BOM, LF only, and pads short rows", async () => {
    const sheet = await parseImportFile(enc("a,b,c\n1,2\n"), "x.CSV");
    expect(sheet.rows).toEqual([["1", "2", ""]]);
  });

  it("detects semicolon delimiter", () => {
    expect(parseCsvText("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("throws Thai errors for empty / unsupported / broken files", async () => {
    await expect(parseImportFile(new ArrayBuffer(0), "x.csv")).rejects.toThrow(/ไฟล์ว่าง/);
    await expect(parseImportFile(enc("\r\n,,\r\n"), "x.csv")).rejects.toThrow(/ไฟล์ว่าง/);
    await expect(parseImportFile(enc("x"), "x.pdf")).rejects.toThrow(/ไม่รองรับ/);
    await expect(parseImportFile(enc("x"), "x.xls")).rejects.toThrow(/\.xls/);
    await expect(parseImportFile(enc("not a zip"), "x.xlsx")).rejects.toThrow(/เสียหาย/);
    await expect(parseImportFile(enc('a,b\n"open,1'), "x.csv")).rejects.toThrow(/เครื่องหมายคำพูด/);
    const fakeZip = new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3, 4, 5]).buffer;
    await expect(parseImportFile(fakeZip, "x.xlsx")).rejects.toThrow(/เสียหาย/);
  });
});

describe("parseImportFile (XLSX)", () => {
  it("reads first sheet; rich text / number / date / formula → string; skips empty rows", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("ข้อมูล");
    wb.addWorksheet("อื่น").addRow(["ไม่ควรอ่าน"]);
    ws.addRow(["รหัสห้อง", "ชื่อห้อง", "ความจุ", "วันที่", "สูตร"]);
    ws.addRow(["IT4", { richText: [{ text: "ห้อง " }, { text: "IT4", font: { bold: true } }] }, 30, new Date(Date.UTC(2026, 10, 11)), { formula: "1+1", result: 2 }]);
    ws.addRow([]);
    ws.addRow(["LC03", "ห้องภาษา", 40.5, null, null]);
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const sheet = await parseImportFile(buf, "rooms.xlsx");
    expect(sheet.headers).toEqual(["รหัสห้อง", "ชื่อห้อง", "ความจุ", "วันที่", "สูตร"]);
    expect(sheet.rows).toEqual([
      ["IT4", "ห้อง IT4", "30", "2026-11-11", "2"],
      ["LC03", "ห้องภาษา", "40.5", "", ""],
    ]);
    expect(sheet.rowNumbers).toEqual([2, 4]);
  });
});

describe("autoMapColumns", () => {
  it("matches by header (trim/case-insensitive), key, alias; unknown → null", () => {
    const spec = IMPORT_SPECS.courses;
    const m = autoMapColumns(spec, [" CODE ", "ชื่อรายวิชา", "ท.", "ปฏิบัติ (ป.)", "หน่วยกิต (น.)*", "อะไรก็ไม่รู้"]);
    expect(m.code).toBe(0);
    expect(m.name).toBe(1);
    expect(m.theory).toBe(2);
    expect(m.practice).toBe(3);
    expect(m.credits).toBe(4);
    expect(m.roomType).toBeNull();
  });
});

describe("slot list format", () => {
  it("parses and formats Thai short day slot lists", () => {
    const r = parseSlotList("จ.1-3, พ.7; พฤ. 12-13, 5, วันศุกร์ ๒");
    expect(r.errors).toEqual([]);
    expect(r.slots).toEqual([
      { day: 0, period: 1 },
      { day: 0, period: 2 },
      { day: 0, period: 3 },
      { day: 2, period: 7 },
      { day: 3, period: 5 },
      { day: 3, period: 12 },
      { day: 3, period: 13 },
      { day: 4, period: 2 },
    ]);
    expect(formatSlotList(r.slots)).toBe("จ.1-3, พ.7, พฤ.5, 12-13, ศ.2");
    expect(parseSlotList(formatSlotList(r.slots)).slots).toEqual(r.slots);
  });

  it("reports errors", () => {
    expect(parseSlotList("x.1").errors[0]).toMatch(/ไม่รู้จักวัน/);
    expect(parseSlotList("5").errors[0]).toMatch(/ไม่ได้ระบุวัน/);
    expect(parseSlotList("จ.14", { maxPeriod: 13 }).errors[0]).toMatch(/เกินจำนวนคาบ/);
    expect(parseSlotList("จ.3-1").errors[0]).toMatch(/ช่วงคาบไม่ถูกต้อง/);
  });
});
