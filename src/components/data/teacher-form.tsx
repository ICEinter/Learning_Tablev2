"use client";
import { useMemo, useState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { newId } from "@/lib/id";
import { useData } from "@/lib/store/data-context";
import { TeacherSchema } from "@/shared/schemas";
import type { SlotRef, Teacher } from "@/shared/types";
import { EntityFormDialog, FormGrid, FormSection, useEntitySave } from "./entity-form-dialog";
import { hasErrors, isDuplicateCode, optionalText, schemaErrors, toNumber, type FieldErrors } from "./form-utils";
import { useLookups } from "./lookups";
import { MultiSelect } from "./multi-select";
import { NumberInput } from "./number-input";
import { SlotPicker } from "./slot-picker";

const PREFIXES = ["นาย", "นาง", "นางสาว", "ดร.", "ว่าที่ร้อยตรี"];
const POSITIONS = ["ข้าราชการครู", "พนักงานราชการ", "ครูพิเศษ", "ครูอัตราจ้าง"];

function TextField({ label, value, onChange, error, required, list }: { label: string; value: string; onChange: (v: string) => void; error?: string; required?: boolean; list?: string[] }) {
  return (
    <Field label={label} error={error} required={required}>
      {(id) => (
        <>
          <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} list={list ? `${id}-l` : undefined} />
          {list && (
            <datalist id={`${id}-l`}>
              {list.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          )}
        </>
      )}
    </Field>
  );
}

export function TeacherForm({ initial, onClose }: { initial: Teacher | null; onClose: () => void }) {
  const { dataset } = useData();
  const lk = useLookups();
  const { save, saving } = useEntitySave("teachers");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [code, setCode] = useState(initial?.code ?? "");
  const [prefix, setPrefix] = useState(initial?.prefix ?? "นาย");
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [position, setPosition] = useState(initial?.position ?? "ข้าราชการครู");
  const [degree, setDegree] = useState(initial?.degree ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [specialDuty, setSpecialDuty] = useState(initial?.specialDuty ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [qualified, setQualified] = useState<string[]>(initial?.qualifiedCourseIds ?? []);
  const [maxPerDay, setMaxPerDay] = useState(String(initial?.maxPerDay ?? 6));
  const [maxPerWeek, setMaxPerWeek] = useState(String(initial?.maxPerWeek ?? 24));
  const [unavailable, setUnavailable] = useState<SlotRef[]>(initial?.unavailable ?? []);
  const [preferredOff, setPreferredOff] = useState<SlotRef[]>(initial?.preferredOff ?? []);

  const courseOptions = useMemo(
    () => dataset.courses.map((c) => ({ value: c.id, label: `${c.code} ${c.name}`, hint: c.department })),
    [dataset.courses],
  );
  const load = initial ? (lk.teacherLoad.get(initial.id) ?? 0) : 0;
  const maxW = toNumber(maxPerWeek);
  const assigned = initial ? dataset.assignments.filter((a) => a.teacherId === initial.id) : [];
  const notQualified = assigned.filter((a) => qualified.length > 0 && !qualified.includes(a.courseId));

  const submit = async () => {
    const item: Teacher = {
      id: initial?.id ?? newId("t"),
      code: code.trim(),
      prefix: prefix.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      position: position.trim(),
      degree: optionalText(degree),
      department: optionalText(department),
      specialDuty: optionalText(specialDuty),
      email: optionalText(email),
      qualifiedCourseIds: qualified,
      maxPerDay: toNumber(maxPerDay),
      maxPerWeek: toNumber(maxPerWeek),
      unavailable,
      preferredOff,
    };
    const errs = schemaErrors(TeacherSchema, item);
    if (isDuplicateCode(dataset.teachers, item.code, item.id)) errs.code = `รหัสครู ${item.code} มีอยู่แล้ว`;
    setErrors(errs);
    if (hasErrors(errs)) return;
    if (await save(item, !initial)) onClose();
  };

  return (
    <EntityFormDialog title={initial ? `แก้ไขข้อมูลครู ${initial.code}` : "เพิ่มครู"} onClose={onClose} onSubmit={submit} saving={saving} errors={errors}>
      <FormSection title="ข้อมูลทั่วไป">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_1fr_1fr]">
          <TextField label="คำนำหน้า" required value={prefix} onChange={setPrefix} error={errors.prefix} list={PREFIXES} />
          <TextField label="ชื่อ" required value={firstName} onChange={setFirstName} error={errors.firstName} />
          <TextField label="นามสกุล" required value={lastName} onChange={setLastName} error={errors.lastName} />
        </div>
        <FormGrid>
          <TextField label="รหัสครู" required value={code} onChange={setCode} error={errors.code} />
          <TextField label="ตำแหน่ง" required value={position} onChange={setPosition} error={errors.position} list={POSITIONS} />
          <TextField label="วุฒิการศึกษา" value={degree} onChange={setDegree} error={errors.degree} />
          <TextField label="แผนกวิชา" value={department} onChange={setDepartment} error={errors.department} list={lk.departments} />
          <TextField label="หน้าที่พิเศษ" value={specialDuty} onChange={setSpecialDuty} error={errors.specialDuty} />
          <Field label="อีเมล" error={errors.email}>
            {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection title="ภาระสอน">
        <FormGrid>
          <Field label="สูงสุดต่อวัน (คาบ)" required error={errors.maxPerDay}>
            {(id) => <NumberInput id={id} min={1} value={maxPerDay} onChange={setMaxPerDay} />}
          </Field>
          <Field label="สูงสุดต่อสัปดาห์ (คาบ)" required error={errors.maxPerWeek}>
            {(id) => <NumberInput id={id} min={1} value={maxPerWeek} onChange={setMaxPerWeek} />}
          </Field>
        </FormGrid>
        {initial && (
          <Alert tone={!Number.isNaN(maxW) && load > maxW ? "warn" : "neutral"}>
            ภาระที่มอบหมายแล้ว <strong>{load}</strong> คาบ/สัปดาห์ จากสูงสุด {Number.isNaN(maxW) ? "-" : maxW} คาบ ({assigned.length} รายการ)
            {!Number.isNaN(maxW) && load > maxW ? " — เกินภาระสูงสุด" : ""}
          </Alert>
        )}
      </FormSection>

      <FormSection title="รายวิชาที่สอนได้" description="ถ้าไม่เลือกเลย ถือว่าสอนได้ทุกวิชา">
        <Field label="ค้นหารายวิชา" error={errors.qualifiedCourseIds}>
          {(id) => <MultiSelect id={id} options={courseOptions} value={qualified} onChange={setQualified} placeholder="รหัสหรือชื่อวิชา" />}
        </Field>
        {notQualified.length > 0 && (
          <Alert tone="warn">
            มี {notQualified.length} รายการมอบหมายสอนที่วิชาไม่อยู่ในรายการนี้: {notQualified.map((a) => lk.courseById.get(a.courseId)?.code ?? a.courseId).join(", ")}
          </Alert>
        )}
      </FormSection>

      <FormSection title="เวลาไม่ว่าง (บังคับ)" description="ระบบจะไม่จัดคาบสอนในช่องที่เลือก">
        <SlotPicker time={dataset.time} value={unavailable} onChange={setUnavailable} tone="danger" label="เวลาไม่ว่างของครู" />
      </FormSection>
      <FormSection title="ช่วงเวลาที่ขอเลี่ยง (ถ้าเป็นไปได้)" description="ระบบจะพยายามเลี่ยง แต่อาจจัดได้ถ้าจำเป็น">
        <SlotPicker time={dataset.time} value={preferredOff} onChange={setPreferredOff} tone="warn" label="ช่วงเวลาที่ครูขอเลี่ยง" />
      </FormSection>
    </EntityFormDialog>
  );
}
