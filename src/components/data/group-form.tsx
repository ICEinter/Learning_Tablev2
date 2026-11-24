"use client";
import { useState } from "react";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { newId } from "@/lib/id";
import { useData } from "@/lib/store/data-context";
import { GroupSchema } from "@/shared/schemas";
import { teacherName } from "@/shared/slots";
import type { StudentGroup } from "@/shared/types";
import { EntityFormDialog, FormGrid, useEntitySave } from "./entity-form-dialog";
import { hasErrors, isDuplicateCode, optionalText, schemaErrors, toNumber, type FieldErrors } from "./form-utils";
import { useLookups } from "./lookups";
import { NumberInput } from "./number-input";

const LEVELS = ["ปวช.", "ปวส.", "ป.ตรี"];

export function GroupForm({ initial, onClose }: { initial: StudentGroup | null; onClose: () => void }) {
  const { dataset } = useData();
  const lk = useLookups();
  const { save, saving } = useEntitySave("groups");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [level, setLevel] = useState(initial?.level ?? "ปวช.");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [size, setSize] = useState(String(initial?.size ?? 30));
  const [advisor, setAdvisor] = useState(initial?.advisorTeacherId ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const submit = async () => {
    const item: StudentGroup = {
      id: initial?.id ?? newId("g"),
      code: code.trim(),
      name: name.trim(),
      level: level.trim(),
      department: optionalText(department),
      size: toNumber(size),
      advisorTeacherId: advisor || undefined,
      note: optionalText(note),
    };
    const errs = schemaErrors(GroupSchema, item);
    if (isDuplicateCode(dataset.groups, item.code, item.id)) errs.code = `รหัสกลุ่ม ${item.code} มีอยู่แล้ว`;
    setErrors(errs);
    if (hasErrors(errs)) return;
    if (await save(item, !initial)) onClose();
  };

  const periods = initial ? (lk.groupPeriods.get(initial.id) ?? 0) : 0;
  const asgCount = initial ? dataset.assignments.filter((a) => a.groupIds.includes(initial.id)).length : 0;

  return (
    <EntityFormDialog title={initial ? `แก้ไขกลุ่มเรียน ${initial.code}` : "เพิ่มกลุ่มเรียน"} onClose={onClose} onSubmit={submit} saving={saving} errors={errors}>
      {initial && (
        <Alert tone="neutral">
          คาบเรียนที่มอบหมายแล้ว <strong>{periods}</strong> คาบ/สัปดาห์ ({asgCount} รายการ)
        </Alert>
      )}
      <FormGrid>
        <Field label="รหัสกลุ่ม" required error={errors.code}>
          {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น สIT.1/1" autoFocus />}
        </Field>
        <Field label="ชื่อกลุ่ม" required error={errors.name}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="ระดับชั้น" required error={errors.level}>
          {(id) => (
            <>
              <Input id={id} list={`${id}-l`} value={level} onChange={(e) => setLevel(e.target.value)} />
              <datalist id={`${id}-l`}>
                {LEVELS.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="แผนกวิชา" error={errors.department}>
          {(id) => (
            <>
              <Input id={id} list={`${id}-l`} value={department} onChange={(e) => setDepartment(e.target.value)} />
              <datalist id={`${id}-l`}>
                {lk.departments.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="จำนวนผู้เรียน" required error={errors.size}>
          {(id) => <NumberInput id={id} min={1} value={size} onChange={setSize} />}
        </Field>
        <Field label="ครูที่ปรึกษา" error={errors.advisorTeacherId}>
          {(id) => (
            <Select id={id} value={advisor} onChange={(e) => setAdvisor(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {dataset.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {teacherName(t)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </FormGrid>
      <Field label="หมายเหตุ" error={errors.note} hint="เช่น จบ ม.6, ต่างสาขา, ทวิภาคี">
        {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </EntityFormDialog>
  );
}
