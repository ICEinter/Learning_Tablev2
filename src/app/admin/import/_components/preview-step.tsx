"use client";
import { useMemo, useState } from "react";
import { Badge, Button, Card, DataTable, Stat, Tabs, cx } from "@/components/ui";
import { Pagination, pageSlice } from "@/components/data/pagination";
import type { ImportPreview, PreviewRow } from "@/lib/import/preview";
import type { ImportSpec } from "@/lib/import/specs";

type Filter = "all" | "error" | "warning" | "ok";

const ACTION: Record<PreviewRow["action"], { label: string; tone: "ok" | "accent" | "danger" }> = {
  create: { label: "เพิ่มใหม่", tone: "ok" },
  update: { label: "แก้ไข", tone: "accent" },
  error: { label: "ผิดพลาด", tone: "danger" },
};

function matches(row: PreviewRow, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "error") return row.action === "error";
  if (f === "warning") return row.issues.some((i) => i.level === "warning");
  return row.action !== "error" && row.issues.length === 0;
}

export function ActionBadge({ action }: { action: PreviewRow["action"] }) {
  const a = ACTION[action];
  return <Badge tone={a.tone}>{a.label}</Badge>;
}

export function PreviewStep({ spec, preview, onBack, onNext }: { spec: ImportSpec; preview: ImportPreview; onBack: () => void; onNext: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const { summary } = preview;
  const okCount = preview.rows.filter((r) => matches(r, "ok")).length;
  const rowsF = useMemo(() => preview.rows.filter((r) => matches(r, filter)), [preview.rows, filter]);
  const { rows, page: current, pageCount } = pageSlice(rowsF, page);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ทั้งหมด" value={summary.total} />
        <Stat label="เพิ่มใหม่" value={summary.create} tone="ok" />
        <Stat label="แก้ไข" value={summary.update} tone="accent" />
        <Stat label="ผิดพลาด" value={summary.error} tone={summary.error ? "danger" : "neutral"} hint={summary.warning ? `มีคำเตือน ${summary.warning} แถว` : undefined} />
      </div>
      <Card title="4. ตรวจสอบข้อมูลก่อนบันทึก (ยังไม่มีการบันทึก)">
        <Tabs<Filter>
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setPage(1);
          }}
          items={[
            { value: "all", label: `ทั้งหมด (${summary.total})` },
            { value: "error", label: `ผิดพลาด (${summary.error})` },
            { value: "warning", label: `คำเตือน (${summary.warning})` },
            { value: "ok", label: `ไม่มีปัญหา (${okCount})` },
          ]}
        />
        <div className="mt-3 flex flex-col gap-3">
          {rowsF.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">ไม่มีแถวในกลุ่มนี้</p>
          ) : (
            <DataTable className="max-h-[60vh] overflow-y-auto">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th scope="col">แถว</th>
                  <th scope="col">ผลลัพธ์</th>
                  <th scope="col" className="min-w-[14rem]">
                    ปัญหา
                  </th>
                  {spec.columns.map((c) => (
                    <th key={c.key} scope="col">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const badFields = new Set(r.issues.filter((i) => i.level === "error" && i.field).map((i) => i.field));
                  return (
                    <tr key={r.rowNumber} className={cx("align-top", r.action === "error" && "bg-danger-soft/40")}>
                      <td className="tabular-nums text-muted">{r.rowNumber}</td>
                      <td>
                        <ActionBadge action={r.action} />
                      </td>
                      <td>
                        {r.issues.length === 0 ? (
                          <span className="text-xs text-ok">✓ ไม่มีปัญหา</span>
                        ) : (
                          <ul className="space-y-0.5 text-xs">
                            {r.issues.map((i, n) => (
                              <li key={n} className={i.level === "error" ? "text-danger" : "text-warn"}>
                                {i.level === "error" ? "✕" : "⚠"} {i.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      {spec.columns.map((c) => (
                        <td key={c.key} className={cx("max-w-[16rem] break-words", badFields.has(c.key) && "font-medium text-danger underline decoration-dotted")}>
                          {r.raw[c.key] ?? ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
          <Pagination page={current} pageCount={pageCount} total={rowsF.length} onChange={setPage} />
        </div>
      </Card>
      <div className="flex justify-between gap-2">
        <Button onClick={onBack}>‹ ย้อนกลับ</Button>
        <Button variant="primary" onClick={onNext}>
          ถัดไป: สรุปและยืนยัน ›
        </Button>
      </div>
    </div>
  );
}
