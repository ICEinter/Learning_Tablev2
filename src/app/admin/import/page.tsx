"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Button, Card, PageHeader, useToast } from "@/components/ui";
import { errorMessage } from "@/components/data/form-utils";
import { autoMapColumns, type ParsedSheet } from "@/lib/import/parse";
import { buildImportPreview, itemsToCommit } from "@/lib/import/preview";
import { IMPORT_SPECS, type ImportKind } from "@/lib/import/specs";
import { useData } from "@/lib/store/data-context";
import type { EntityKind, EntityOf } from "@/shared/types";
import { CommitStep } from "./_components/commit-step";
import { KindStep } from "./_components/kind-step";
import { MappingStep, type ColumnMapping } from "./_components/mapping-step";
import { PreviewStep } from "./_components/preview-step";
import { StepIndicator } from "./_components/step-indicator";
import { UploadStep } from "./_components/upload-step";

export default function ImportPage() {
  const { dataset, upsert, loadRayongData, resetToMock } = useData();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ImportKind | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [committing, setCommitting] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [done, setDone] = useState<{ kind: ImportKind; count: number } | null>(null);

  const spec = kind ? IMPORT_SPECS[kind] : null;
  const preview = useMemo(
    () => (step >= 4 && kind && sheet ? buildImportPreview(kind, sheet, mapping, dataset) : null),
    [step, kind, sheet, mapping, dataset],
  );

  const selectKind = (k: ImportKind) => {
    if (k === kind) return;
    setKind(k);
    if (sheet) setMapping(autoMapColumns(IMPORT_SPECS[k], sheet.headers));
  };

  const onParsed = (name: string, parsed: ParsedSheet) => {
    setFileName(name);
    setSheet(parsed);
    if (spec) setMapping(autoMapColumns(spec, parsed.headers));
  };

  const restart = () => {
    setStep(1);
    setFileName(null);
    setSheet(null);
    setMapping({});
    setDone(null);
  };

  const commit = async () => {
    if (!kind || !preview) return;
    const items = itemsToCommit(preview) as EntityOf<EntityKind>[];
    if (items.length === 0) return;
    setCommitting(true);
    try {
      await upsert(kind, items);
      toast(`นำเข้า${IMPORT_SPECS[kind].label} ${items.length} รายการแล้ว`, "ok");
      setDone({ kind, count: items.length });
    } catch (e) {
      toast(`บันทึกไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setCommitting(false);
    }
  };

  const handle1ClickRayong = async () => {
    setLoadingPreset(true);
    try {
      await loadRayongData();
      toast("โหลดชุดข้อมูลจริง วท.ระยอง 2/2569 (ครู 10 ท่าน, 12 กลุ่ม, 36 วิชา) สำเร็จใน 1-Click!", "ok");
    } catch (e) {
      toast(`โหลดไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setLoadingPreset(false);
    }
  };

  return (
    <>
      <PageHeader
        title="นำเข้าข้อมูล"
        description="นำเข้าข้อมูลหลักจากไฟล์ Excel (.xlsx) หรือ CSV — ตรวจสอบก่อนบันทึกทุกครั้ง หรือเลือกโหลดข้อมูลตัวอย่างพร้อมใช้ใน 1 คลิก"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={loadingPreset}
              onClick={handle1ClickRayong}
              title="โหลดชุดข้อมูลจริง แผนกเทคโนโลยีสารสนเทศ วิทยาลัยเทคนิคระยอง ภาคเรียน 2/2569 ทั้งหมด"
            >
              ⚡ 1-Click โหลดข้อมูลจริง วท.ระยอง
            </Button>
            <Button variant="secondary" size="sm" onClick={() => resetToMock().then(() => toast("โหลดชุดข้อมูลมาตรฐานสังเคราะห์แล้ว", "ok"))}>
              🔄 ข้อมูลจำลองสังเคราะห์
            </Button>
          </div>
        }
      />

      {done ? (
        <Card title="นำเข้าสำเร็จ">
          <div className="flex flex-col gap-4">
            <Alert tone="ok" title={`บันทึก ${IMPORT_SPECS[done.kind].label} ${done.count} รายการแล้ว`}>
              ตรวจสอบหรือแก้ไขเพิ่มเติมได้ที่หน้าจัดการข้อมูล
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/data?tab=${done.kind}`}
                className="inline-flex h-10 items-center rounded-md border border-accent bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
              >
                ไปที่ข้อมูล{IMPORT_SPECS[done.kind].label}
              </Link>
              <Button onClick={restart}>นำเข้าไฟล์อื่น</Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-primary">💡 ต้องการทดสอบความเร็วแบบ 1-Click หรือไม่?</h3>
                <p className="text-xs text-muted">
                  คลิกปุ่มเพื่อโหลดข้อมูลโครงสร้างจริงของ วิทยาลัยเทคนิคระยอง ภาค 2/2569 (ครู 10 ท่าน, ปวช./ปวส. 12 กลุ่ม, 36 วิชา) เข้าสู่ระบบทันที
                </p>
              </div>
              <Button variant="primary" size="sm" loading={loadingPreset} onClick={handle1ClickRayong}>
                โหลดข้อมูลจริง วท.ระยอง (1-Click)
              </Button>
            </div>
          </div>

          <StepIndicator step={step} />
          {step === 1 && <KindStep kind={kind} onSelect={selectKind} onNext={() => setStep(2)} />}
          {step === 2 && spec && (
            <UploadStep label={spec.label} fileName={fileName} sheet={sheet} onParsed={onParsed} onBack={() => setStep(1)} onNext={() => setStep(3)} />
          )}
          {step === 3 && spec && sheet && <MappingStep spec={spec} sheet={sheet} mapping={mapping} onChange={setMapping} onBack={() => setStep(2)} onNext={() => setStep(4)} />}
          {step === 4 && spec && preview && <PreviewStep spec={spec} preview={preview} onBack={() => setStep(3)} onNext={() => setStep(5)} />}
          {step === 5 && spec && preview && fileName && (
            <CommitStep label={spec.label} fileName={fileName} preview={preview} committing={committing} onBack={() => setStep(4)} onCommit={commit} />
          )}
        </>
      )}
    </>
  );
}