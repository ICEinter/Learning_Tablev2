"use client";
import { useMemo, useState } from "react";
import { Alert, Field, Input, Select } from "@/components/ui";
import { newId } from "@/lib/id";
import { useData } from "@/lib/store/data-context";
import { StudentSchema } from "@/shared/schemas";
import type { Student } from "@/shared/types";
import { EntityFormDialog, FormGrid, FormSection, useEntitySave } from "./entity-form-dialog";
import { hasErrors, isDuplicateCode, schemaErrors, type FieldErrors } from "./form-utils";
import { useLookups } from "./lookups";
import { MultiSelect } from "./multi-select";

export function StudentForm({ initial, onClose }: { initial: Student | null; onClose: () => void }) {
  const { dataset } = useData();
  const lk = useLookups();
  const { save, saving } = useEntitySave("students");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [code, setCode] = useState(initial?.code ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [groupId, setGroupId] = useState(initial?.groupId ?? "");
  const [extra, setExtra] = useState<string[]>(initial?.extraAssignmentIds ?? []);

  const options = useMemo(
    () =>
      dataset.assignments
        .filter((a) => !groupId || !a.groupIds.includes(groupId))
        .map((a) => ({ value: a.id, label: lk.assignmentLabel(a), hint: lk.courseById.get(a.courseId)?.name })),
    [dataset.assignments, groupId, lk],
  );

  const submit = async () => {
    const item: Student = {
      id: initial?.id ?? newId("s"),
      code: code.trim(),
      displayName: displayName.trim(),
      groupId,
      extraAssignmentIds: extra,
    };
    const errs = schemaErrors(StudentSchema, item);
    if (!groupId) errs.groupId = "ต้องเลือกกลุ่มเรียน";
    if (isDuplicateCode(dataset.students, item.code, item.id)) errs.code = `รหัสนักเรียน ${item.code} มีอยู่แล้ว`;
    setErrors(errs);
    if (hasErrors(errs)) return;
    if (await save(item, !initial)) onClose();
  };

  return (
    <EntityFormDialog title={initial ? `แก้ไขนักเรียน ${initial.code}` : "เพิ่มนักเรียน"} onClose={onClose} onSubmit={submit} saving={saving} errors={errors}>
      <Alert tone="neutral" title="เก็บข้อมูลส่วนบุคคลเท่าที่จำเป็น">
        ระบบเก็บเพียงรหัส ชื่อที่แสดง และกลุ่มเรียน — ห้ามกรอกเลขบัตรประชาชน วันเกิด ที่อยู่ หรือเบอร์โทร
      </Alert>
      <FormGrid>
        <Field label="รหัสนักเรียน" required error={errors.code}>
          {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="off" />}
        </Field>
        <Field label="ชื่อที่แสดง" required error={errors.displayName}>
          {(id) => <Input id={id} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="off" />}
        </Field>
        <Field label="กลุ่มเรียน" required error={errors.groupId}>
          {(id) => (
            <Select id={id} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">— เลือกกลุ่มเรียน —</option>
              {dataset.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} · {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </FormGrid>
      <FormSection title="รายวิชาที่ลงเรียนเพิ่มนอกกลุ่ม" description="เช่น เรียนซ้ำ หรือวิชาเลือกข้ามกลุ่ม (แสดงเฉพาะรายการที่ไม่ใช่ของกลุ่มตนเอง)">
        <Field label="ค้นหาการมอบหมายสอน (รหัสวิชา — กลุ่ม — ครู)" error={errors.extraAssignmentIds}>
          {(id) => <MultiSelect id={id} options={options} value={extra} onChange={setExtra} placeholder="รหัสวิชา กลุ่ม หรือชื่อครู" />}
        </Field>
      </FormSection>
    </EntityFormDialog>
  );
}
