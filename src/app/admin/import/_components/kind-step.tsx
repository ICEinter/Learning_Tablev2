"use client";
import { useState } from "react";
import { Badge, Button, Card, cx, useToast } from "@/components/ui";
import { errorMessage } from "@/components/data/form-utils";
import { downloadBlob } from "@/lib/export/download";
import { IMPORT_SPECS, type ImportKind } from "@/lib/import/specs";
import { buildTemplate } from "@/lib/import/templates";
import { useData } from "@/lib/store/data-context";

/** ลำดับนำเข้าที่แนะนำ (ข้อมูลที่ถูกอ้างอิงต้องมาก่อน) */
export const RECOMMENDED_ORDER: ImportKind[] = ["rooms", "courses", "teachers", "groups", "assignments", "students", "activities"];

export function KindStep({ kind, onSelect, onNext }: { kind: ImportKind | null; onSelect: (k: ImportKind) => void; onNext: () => void }) {
  const { dataset } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (k: ImportKind, format: "xlsx" | "csv") => {
    setBusy(`${k}:${format}`);
    try {
      const blob = await buildTemplate(k, format);
      downloadBlob(blob, `แม่แบบนำเข้า-${IMPORT_SPECS[k].label}.${format}`);
    } catch (e) {
      toast(`สร้างแม่แบบไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setBusy(null);
    }
  };

  const spec = kind ? IMPORT_SPECS[kind] : null;

  return (
    <div className="flex flex-col gap-4">
      <Card title="1. เลือกประเภทข้อมูลที่จะนำเข้า">
        <p className="mb-3 text-sm text-muted">แนะนำให้นำเข้าตามลำดับ เพราะข้อมูลบางประเภทอ้างอิงรหัสของประเภทก่อนหน้า</p>
        <div role="radiogroup" aria-label="ประเภทข้อมูล" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {RECOMMENDED_ORDER.map((k, i) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => onSelect(k)}
              className={cx(
                "flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                kind === k ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent",
              )}
            >
              <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", kind === k ? "bg-accent text-white" : "bg-page text-muted")}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{IMPORT_SPECS[k].label}</span>
                <span className="block text-xs text-muted">มีอยู่ {dataset[k].length} รายการ</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {spec && kind && (
        <Card
          title={`คอลัมน์ของไฟล์ ${spec.label}`}
          actions={
            <>
              <Button size="sm" loading={busy === `${kind}:xlsx`} onClick={() => download(kind, "xlsx")}>
                ดาวน์โหลดแม่แบบ .xlsx
              </Button>
              <Button size="sm" loading={busy === `${kind}:csv`} onClick={() => download(kind, "csv")}>
                ดาวน์โหลดแม่แบบ .csv
              </Button>
            </>
          }
        >
          <ul className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            {spec.columns.map((c) => (
              <li key={c.key} className="rounded-md border border-line px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.header}</span>
                  {c.required ? <Badge tone="danger">จำเป็น</Badge> : <Badge>ไม่บังคับ</Badge>}
                </div>
                {(c.help || c.example) && (
                  <p className="mt-0.5 text-xs text-muted">
                    {c.help}
                    {c.help && c.example ? " · " : ""}
                    {c.example ? `ตัวอย่าง: ${c.example}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="primary" disabled={!kind} onClick={onNext}>
          ถัดไป: อัปโหลดไฟล์ ›
        </Button>
      </div>
    </div>
  );
}
