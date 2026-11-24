import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createMockDataset } from "@/data/mock";
import { autoMapColumns, parseImportFile } from "@/lib/import/parse";
import { buildImportPreview, itemsToCommit } from "@/lib/import/preview";
import { IMPORT_KINDS, IMPORT_SPECS } from "@/lib/import/specs";
import { buildTemplate } from "@/lib/import/templates";
import { ENTITY_SCHEMAS } from "@/shared/schemas";

const ds = createMockDataset();

describe("buildTemplate → parse → autoMap → preview", () => {
  for (const kind of IMPORT_KINDS) {
    for (const format of ["xlsx", "csv"] as const) {
      it(`${kind} (${format})`, async () => {
        const blob = await buildTemplate(kind, format);
        const buf = await blob.arrayBuffer();
        if (format === "csv") {
          const bytes = new Uint8Array(buf);
          expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
        }
        const sheet = await parseImportFile(buf, `t.${format}`);
        const spec = IMPORT_SPECS[kind];
        expect(sheet.headers).toEqual(spec.columns.map((c) => c.header));
        expect(sheet.rows.length).toBeGreaterThanOrEqual(1);
        const mapping = autoMapColumns(spec, sheet.headers);
        for (const c of spec.columns) expect(mapping[c.key], c.key).not.toBeNull();
        const p = buildImportPreview(kind, sheet, mapping, ds);
        const errors = p.rows.flatMap((r) => r.issues.filter((i) => i.level === "error").map((i) => `row ${r.rowNumber}: ${i.message}`));
        expect(errors).toEqual([]);
        for (const it of itemsToCommit(p)) expect(ENTITY_SCHEMAS[kind].safeParse(it).success).toBe(true);
      });
    }
  }

  it("xlsx template has an explanation sheet", async () => {
    const blob = await buildTemplate("teachers", "xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(["ครู", "คำอธิบาย"]);
    const help = wb.getWorksheet("คำอธิบาย")!;
    expect(help.getCell("A1").value).toBe("หัวคอลัมน์");
    expect(help.getCell("A2").value).toBe("รหัสครู");
    expect(help.getCell("B2").value).toBe("จำเป็น");
  });
});
