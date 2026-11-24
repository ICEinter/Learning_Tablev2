"use client";
import { useState } from "react";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui";
import { newId } from "@/lib/id";
import { useData } from "@/lib/store/data-context";
import { CourseSchema } from "@/shared/schemas";
import { ROOM_TYPE_LABEL, type Course, type RoomType } from "@/shared/types";
import { EntityFormDialog, FormGrid, useEntitySave } from "./entity-form-dialog";
import { hasErrors, isDuplicateCode, optionalText, parseNumberList, schemaErrors, toNumber, type FieldErrors } from "./form-utils";
import { useLookups } from "./lookups";
import { BlockSumHint, NumberInput } from "./number-input";
import { TagInput } from "./tag-input";

export function CourseForm({ initial, onClose }: { initial: Course | null; onClose: () => void }) {
  const { dataset } = useData();
  const lk = useLookups();
  const { save, saving } = useEntitySave("courses");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [theory, setTheory] = useState(String(initial?.theory ?? 1));
  const [practice, setPractice] = useState(String(initial?.practice ?? 2));
  const [credits, setCredits] = useState(String(initial?.credits ?? 2));
  const [ppw, setPpw] = useState(String(initial?.periodsPerWeek ?? 3));
  const [blocks, setBlocks] = useState(initial?.blockSizes.join(",") ?? "3");
  const [roomType, setRoomType] = useState<RoomType>(initial?.roomType ?? "lecture");
  const [equipment, setEquipment] = useState<string[]>(initial?.requiredEquipment ?? []);
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [isActivity, setIsActivity] = useState(Boolean(initial?.isActivity));

  const submit = async () => {
    const blockList = parseNumberList(blocks);
    const item: Course = {
      id: initial?.id ?? newId("c"),
      code: code.trim(),
      name: name.trim(),
      theory: toNumber(theory),
      practice: toNumber(practice),
      credits: toNumber(credits),
      periodsPerWeek: toNumber(ppw),
      blockSizes: blockList ?? [],
      roomType,
      requiredEquipment: equipment,
      department: optionalText(department),
      isActivity: isActivity || undefined,
    };
    const errs = schemaErrors(CourseSchema, item);
    if (blockList === null) errs.blockSizes = "รูปแบบไม่ถูกต้อง ใช้จำนวนเต็มบวกคั่นด้วยจุลภาค เช่น 1,2,2";
    if (isDuplicateCode(dataset.courses, item.code, item.id)) errs.code = `รหัสวิชา ${item.code} มีอยู่แล้ว`;
    setErrors(errs);
    if (hasErrors(errs)) return;
    if (await save(item, !initial)) onClose();
  };

  const tp = toNumber(theory) + toNumber(practice);

  return (
    <EntityFormDialog title={initial ? `แก้ไขรายวิชา ${initial.code}` : "เพิ่มรายวิชา"} onClose={onClose} onSubmit={submit} saving={saving} errors={errors}>
      <FormGrid>
        <Field label="รหัสวิชา" required error={errors.code}>
          {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น 31901-2008" autoFocus />}
        </Field>
        <Field label="ชื่อวิชา" required error={errors.name}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
      </FormGrid>
      <div className="grid grid-cols-3 gap-3">
        <Field label="ท. (ทฤษฎี)" error={errors.theory}>
          {(id) => <NumberInput id={id} min={0} value={theory} onChange={setTheory} />}
        </Field>
        <Field label="ป. (ปฏิบัติ)" error={errors.practice}>
          {(id) => <NumberInput id={id} min={0} value={practice} onChange={setPractice} />}
        </Field>
        <Field label="น. (หน่วยกิต)" error={errors.credits}>
          {(id) => <NumberInput id={id} min={0} value={credits} onChange={setCredits} />}
        </Field>
      </div>
      <FormGrid>
        <Field label="คาบต่อสัปดาห์" required error={errors.periodsPerWeek} hint="ปกติ = ท. + ป.">
          {(id) => (
            <div className="flex gap-2">
              <NumberInput id={id} min={1} value={ppw} onChange={setPpw} />
              {!Number.isNaN(tp) && tp > 0 && String(tp) !== ppw && (
                <Button type="button" size="sm" className="h-10" onClick={() => setPpw(String(tp))}>
                  ใช้ {tp}
                </Button>
              )}
            </div>
          )}
        </Field>
        <Field label="การแบ่งคาบต่อเนื่อง" required error={errors.blockSizes}>
          {(id) => (
            <>
              <Input id={id} value={blocks} onChange={(e) => setBlocks(e.target.value)} placeholder="เช่น 1,2,2" inputMode="numeric" aria-describedby={`${id}-sum`} />
              <div id={`${id}-sum`}>
                <BlockSumHint blocks={blocks} expected={toNumber(ppw)} />
              </div>
            </>
          )}
        </Field>
        <Field label="ประเภทห้องที่ต้องใช้" required error={errors.roomType}>
          {(id) => (
            <Select id={id} value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)}>
              {(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => (
                <option key={t} value={t}>
                  {ROOM_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="แผนกวิชา" error={errors.department}>
          {(id) => (
            <>
              <Input id={id} list={`${id}-list`} value={department} onChange={(e) => setDepartment(e.target.value)} />
              <datalist id={`${id}-list`}>
                {lk.departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </FormGrid>
      <Field label="อุปกรณ์ที่ต้องใช้" error={errors.requiredEquipment} hint="ห้องที่จัดให้ต้องมีอุปกรณ์ครบทุกรายการ">
        {(id) => <TagInput id={id} value={equipment} onChange={setEquipment} suggestions={lk.equipment} />}
      </Field>
      <Checkbox label="เป็นวิชากิจกรรม (แสดงแยกจากวิชาสอนในสรุปภาระ)" checked={isActivity} onChange={setIsActivity} />
    </EntityFormDialog>
  );
}
