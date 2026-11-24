"use client";
import { useState } from "react";
import { Button, Card, Field, Input, useToast } from "@/components/ui";
import { errorMessage, hasErrors, type FieldErrors } from "@/components/data/form-utils";
import { useData } from "@/lib/store/data-context";
import { SchoolSchema, formatZodIssues } from "@/shared/schemas";
import type { SchoolInfo, Signatory } from "@/shared/types";

const MAX_SIGNATORIES = 6;

export function SchoolSection({ initial }: { initial: SchoolInfo }) {
  const { saveSettings } = useData();
  const toast = useToast();
  const [name, setName] = useState(initial.name);
  const [regularEndTime, setRegularEndTime] = useState(initial.regularEndTime);
  const [signatories, setSignatories] = useState<Signatory[]>(initial.signatories);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const setSig = (i: number, patch: Partial<Signatory>) => setSignatories((xs) => xs.map((s, n) => (n === i ? { ...s, ...patch } : s)));

  const submit = async () => {
    const school: SchoolInfo = {
      ...initial,
      name: name.trim(),
      regularEndTime,
      signatories: signatories.map((s) => ({ name: s.name.trim(), title: s.title.trim() })).filter((s) => s.name || s.title),
    };
    const r = SchoolSchema.safeParse(school);
    const errs: FieldErrors = {};
    if (!r.success) for (const i of formatZodIssues(r.error)) errs[i.path || "_form"] ??= i.message;
    setErrors(errs);
    if (hasErrors(errs)) return;
    setSaving(true);
    try {
      await saveSettings({ school });
      toast("บันทึกข้อมูลสถานศึกษาแล้ว", "ok");
    } catch (e) {
      toast(`บันทึกไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="ข้อมูลสถานศึกษา"
      actions={
        <Button variant="primary" size="sm" loading={saving} onClick={submit}>
          บันทึก
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="ชื่อสถานศึกษา" required error={errors.name}>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="สิ้นสุดเวลาราชการ" required error={errors.regularEndTime} hint="ใช้แยกคาบในเวลา/นอกเวลา">
            {(id) => <Input id={id} type="time" value={regularEndTime} onChange={(e) => setRegularEndTime(e.target.value)} />}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">ผู้ลงนามท้ายตารางสอน (เรียงซ้ายไปขวา สูงสุด {MAX_SIGNATORIES} คน)</legend>
          {signatories.length === 0 && <p className="text-sm text-muted">ยังไม่มีผู้ลงนาม</p>}
          {signatories.map((s, i) => (
            <div key={i} className="grid grid-cols-1 items-end gap-2 rounded-md border border-line p-2 sm:grid-cols-[1fr_1fr_auto] sm:border-0 sm:p-0">
              <Field label={`ชื่อผู้ลงนาม ${i + 1}`} error={errors[`signatories.${i}.name`]}>
                {(id) => <Input id={id} value={s.name} onChange={(e) => setSig(i, { name: e.target.value })} placeholder="เช่น นายสมชาย ใจดี" />}
              </Field>
              <Field label={`ตำแหน่ง ${i + 1}`} error={errors[`signatories.${i}.title`]}>
                {(id) => <Input id={id} value={s.title} onChange={(e) => setSig(i, { title: e.target.value })} placeholder="เช่น รองผู้อำนวยการฝ่ายวิชาการ" />}
              </Field>
              <Button variant="danger" size="sm" className="h-10" onClick={() => setSignatories((xs) => xs.filter((_, n) => n !== i))} aria-label={`ลบผู้ลงนาม ${i + 1}`}>
                ลบ
              </Button>
            </div>
          ))}
          {errors.signatories && <p className="text-xs text-danger">{errors.signatories}</p>}
          <div>
            <Button size="sm" disabled={signatories.length >= MAX_SIGNATORIES} onClick={() => setSignatories((xs) => [...xs, { name: "", title: "" }])}>
              + เพิ่มผู้ลงนาม
            </Button>
          </div>
        </fieldset>
      </div>
    </Card>
  );
}
