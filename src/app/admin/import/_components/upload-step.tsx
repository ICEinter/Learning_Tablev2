"use client";
import { useId, useState, type DragEvent } from "react";
import { Alert, Button, Card, Spinner, cx } from "@/components/ui";
import { errorMessage } from "@/components/data/form-utils";
import { parseImportFile, type ParsedSheet } from "@/lib/import/parse";

const MAX_BYTES = 5 * 1024 * 1024;

export function UploadStep({
  label,
  fileName,
  sheet,
  onParsed,
  onBack,
  onNext,
}: {
  label: string;
  fileName: string | null;
  sheet: ParsedSheet | null;
  onParsed: (fileName: string, sheet: ParsedSheet) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError("รองรับเฉพาะไฟล์ .xlsx และ .csv");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`ไฟล์ใหญ่เกิน 5 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      return;
    }
    setBusy(true);
    try {
      const parsed = await parseImportFile(await file.arrayBuffer(), file.name);
      if (parsed.rows.length === 0) throw new Error("ไม่พบแถวข้อมูล (มีเพียงหัวคอลัมน์หรือไฟล์ว่าง)");
      onParsed(file.name, parsed);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    void handle(e.dataTransfer.files[0]);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card title={`2. อัปโหลดไฟล์${label}`}>
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cx(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors",
            over ? "border-accent bg-accent-soft" : "border-line bg-page hover:border-accent",
          )}
        >
          {busy ? (
            <span className="flex items-center gap-2 text-muted">
              <Spinner /> กำลังอ่านไฟล์…
            </span>
          ) : (
            <>
              <span className="font-medium">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</span>
              <span className="text-sm text-muted">รองรับ .xlsx (ชีตแรก) และ .csv (UTF-8) ขนาดไม่เกิน 5 MB</span>
            </>
          )}
          <input
            id={inputId}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void handle(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <div className="mt-3 flex flex-col gap-2">
          {error && (
            <Alert tone="danger" title="อ่านไฟล์ไม่สำเร็จ">
              {error}
            </Alert>
          )}
          {sheet && fileName && !error && (
            <Alert tone="ok" title={`อ่านไฟล์ ${fileName} แล้ว`}>
              พบ {sheet.headers.length} คอลัมน์ {sheet.rows.length} แถวข้อมูล — ยังไม่มีการบันทึกใด ๆ
            </Alert>
          )}
        </div>
      </Card>
      <div className="flex justify-between gap-2">
        <Button onClick={onBack}>‹ ย้อนกลับ</Button>
        <Button variant="primary" disabled={!sheet} onClick={onNext}>
          ถัดไป: จับคู่คอลัมน์ ›
        </Button>
      </div>
    </div>
  );
}
