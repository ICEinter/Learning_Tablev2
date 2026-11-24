"use client";
import { useState } from "react";
import { Button, Card, Field, Input, Select, useToast } from "@/components/ui";
import { errorMessage, hasErrors, zodFieldErrors, type FieldErrors } from "@/components/data/form-utils";
import { useData } from "@/lib/store/data-context";
import { TermSchema } from "@/shared/schemas";
import type { AcademicTerm } from "@/shared/types";

const STATUS_LABEL: Record<AcademicTerm["status"], string> = {
  setup: "กำลังเตรียมข้อมูล",
  active: "ใช้งานอยู่",
  archived: "เก็บถาวร",
};

export function TermSection({ initial }: { initial: AcademicTerm }) {
  const { saveSettings } = useData();
  const toast = useToast();
  const [year, setYear] = useState(initial.year);
  const [term, setTerm] = useState(initial.term);
  const [status, setStatus] = useState<AcademicTerm["status"]>(initial.status);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value: AcademicTerm = { ...initial, year: year.trim(), term, status };
    const r = TermSchema.safeParse(value);
    const errs = r.success ? {} : zodFieldErrors(r.error);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setSaving(true);
    try {
      await saveSettings({ term: value });
      toast("บันทึกปีการศึกษา/ภาคเรียนแล้ว", "ok");
    } catch (e) {
      toast(`บันทึกไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="ปีการศึกษา / ภาคเรียน"
      actions={
        <Button variant="primary" size="sm" loading={saving} onClick={submit}>
          บันทึก
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="ปีการศึกษา (พ.ศ.)" required error={errors.year}>
          {(id) => <Input id={id} inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value)} placeholder="เช่น 2569" />}
        </Field>
        <Field label="ภาคเรียน" required error={errors.term}>
          {(id) => (
            <Select id={id} value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3 (ฤดูร้อน)</option>
            </Select>
          )}
        </Field>
        <Field label="สถานะ" required error={errors.status}>
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as AcademicTerm["status"])}>
              {(Object.keys(STATUS_LABEL) as AcademicTerm["status"][]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Card>
  );
}
