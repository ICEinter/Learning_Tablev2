"use client";
import { Alert, Badge, Button, Card, Field, Select } from "@/components/ui";
import type { ParsedSheet } from "@/lib/import/parse";
import type { ImportSpec } from "@/lib/import/specs";

export type ColumnMapping = Record<string, number | null>;

export function MappingStep({
  spec,
  sheet,
  mapping,
  onChange,
  onBack,
  onNext,
}: {
  spec: ImportSpec;
  sheet: ParsedSheet;
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const missing = spec.columns.filter((c) => c.required && (mapping[c.key] === null || mapping[c.key] === undefined));
  const usedCount = new Map<number, number>();
  Object.values(mapping).forEach((v) => {
    if (v !== null && v !== undefined) usedCount.set(v, (usedCount.get(v) ?? 0) + 1);
  });
  const sample = (idx: number | null | undefined) =>
    idx === null || idx === undefined
      ? ""
      : sheet.rows
          .slice(0, 3)
          .map((r) => r[idx] ?? "")
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <Card title="3. จับคู่คอลัมน์">
        <p className="mb-4 text-sm text-muted">ระบบจับคู่จากชื่อหัวคอลัมน์ให้อัตโนมัติ ตรวจสอบและแก้ไขได้ — คอลัมน์ที่มี * จำเป็นต้องจับคู่</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {spec.columns.map((c) => {
            const v = mapping[c.key];
            const dup = v !== null && v !== undefined && (usedCount.get(v) ?? 0) > 1;
            return (
              <Field
                key={c.key}
                label={c.header}
                required={c.required}
                error={c.required && (v === null || v === undefined) ? "ยังไม่ได้จับคู่" : dup ? "คอลัมน์นี้ถูกใช้ซ้ำ" : undefined}
                hint={sample(v) ? `ตัวอย่าง: ${sample(v)}` : c.help}
              >
                {(id) => (
                  <Select
                    id={id}
                    value={v === null || v === undefined ? "" : String(v)}
                    onChange={(e) => onChange({ ...mapping, [c.key]: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">— ไม่ใช้ —</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `(คอลัมน์ ${i + 1} ไม่มีหัว)`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            );
          })}
        </div>
        {sheet.headers.some((_, i) => !usedCount.has(i)) && (
          <p className="mt-4 text-xs text-muted">
            คอลัมน์ในไฟล์ที่ไม่ได้ใช้:{" "}
            {sheet.headers
              .map((h, i) => ({ h, i }))
              .filter(({ i }) => !usedCount.has(i))
              .map(({ h, i }) => (
                <Badge key={i} className="mr-1">
                  {h || `คอลัมน์ ${i + 1}`}
                </Badge>
              ))}
          </p>
        )}
      </Card>
      {missing.length > 0 && <Alert tone="danger">ยังไม่ได้จับคู่คอลัมน์ที่จำเป็น: {missing.map((c) => c.header).join(", ")}</Alert>}
      <div className="flex justify-between gap-2">
        <Button onClick={onBack}>‹ ย้อนกลับ</Button>
        <Button variant="primary" disabled={missing.length > 0} onClick={onNext}>
          ถัดไป: ตรวจสอบข้อมูล ›
        </Button>
      </div>
    </div>
  );
}
