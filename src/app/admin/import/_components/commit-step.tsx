"use client";
import { useState } from "react";
import { Alert, Button, Card, Checkbox, Stat } from "@/components/ui";
import type { ImportPreview } from "@/lib/import/preview";

export function CommitStep({
  label,
  fileName,
  preview,
  committing,
  onBack,
  onCommit,
}: {
  label: string;
  fileName: string;
  preview: ImportPreview;
  committing: boolean;
  onBack: () => void;
  onCommit: () => void;
}) {
  const [skipErrors, setSkipErrors] = useState(true);
  const { summary } = preview;
  const valid = summary.create + summary.update;
  const blockedByErrors = summary.error > 0 && !skipErrors;
  const blocked = valid === 0 || blockedByErrors;

  return (
    <div className="flex flex-col gap-4">
      <Card title="5. สรุปและยืนยันการบันทึก">
        <p className="mb-4 text-sm text-muted">
          ไฟล์ {fileName} → {label}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="จะเพิ่มใหม่" value={summary.create} tone="ok" />
          <Stat label="จะแก้ไขข้อมูลเดิม" value={summary.update} tone="accent" />
          <Stat label="ผิดพลาด (จะข้าม)" value={summary.error} tone={summary.error ? "danger" : "neutral"} />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Checkbox label="ข้ามแถวที่ผิดพลาด แล้วบันทึกเฉพาะแถวที่ถูกต้อง" checked={skipErrors} onChange={setSkipErrors} />
          {summary.warning > 0 && <Alert tone="warn">มี {summary.warning} แถวที่มีคำเตือน — จะบันทึกได้ แต่ควรตรวจสอบภายหลังในหน้าจัดการข้อมูล</Alert>}
          {valid === 0 && <Alert tone="danger">ไม่มีแถวที่ถูกต้องให้บันทึก — กรุณาแก้ไขไฟล์แล้วอัปโหลดใหม่</Alert>}
          {valid > 0 && blockedByErrors && (
            <Alert tone="danger">มีแถวผิดพลาด {summary.error} แถว — แก้ไขไฟล์ หรือเลือก &quot;ข้ามแถวที่ผิดพลาด&quot; เพื่อบันทึกเฉพาะแถวที่ถูกต้อง</Alert>
          )}
          {!blocked && (
            <Alert tone="accent">
              เมื่อยืนยัน ระบบจะบันทึก {valid} รายการ{summary.error ? ` และข้าม ${summary.error} แถวที่ผิดพลาด` : ""}
            </Alert>
          )}
        </div>
      </Card>
      <div className="flex justify-between gap-2">
        <Button onClick={onBack} disabled={committing}>
          ‹ ย้อนกลับ
        </Button>
        <Button variant="primary" disabled={blocked} loading={committing} onClick={onCommit}>
          ยืนยันบันทึก {valid} รายการ
        </Button>
      </div>
    </div>
  );
}
