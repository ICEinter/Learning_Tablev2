"use client";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { newId } from "@/lib/id";
import { useData } from "@/lib/store/data-context";
import { RoomSchema } from "@/shared/schemas";
import { ROOM_TYPE_LABEL, type Room, type RoomType, type SlotRef } from "@/shared/types";
import { EntityFormDialog, FormGrid, FormSection, useEntitySave } from "./entity-form-dialog";
import { hasErrors, isDuplicateCode, schemaErrors, toNumber, type FieldErrors } from "./form-utils";
import { useLookups } from "./lookups";
import { NumberInput } from "./number-input";
import { SlotPicker } from "./slot-picker";
import { TagInput } from "./tag-input";

export function RoomForm({ initial, onClose }: { initial: Room | null; onClose: () => void }) {
  const { dataset } = useData();
  const lk = useLookups();
  const { save, saving } = useEntitySave("rooms");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 40));
  const [type, setType] = useState<RoomType>(initial?.type ?? "lecture");
  const [equipment, setEquipment] = useState<string[]>(initial?.equipment ?? []);
  const [unavailable, setUnavailable] = useState<SlotRef[]>(initial?.unavailable ?? []);

  const submit = async () => {
    const item: Room = {
      id: initial?.id ?? newId("r"),
      code: code.trim(),
      name: name.trim(),
      capacity: toNumber(capacity),
      type,
      equipment,
      unavailable,
    };
    const errs = schemaErrors(RoomSchema, item);
    if (isDuplicateCode(dataset.rooms, item.code, item.id)) errs.code = `รหัสห้อง ${item.code} มีอยู่แล้ว`;
    setErrors(errs);
    if (hasErrors(errs)) return;
    if (await save(item, !initial)) onClose();
  };

  return (
    <EntityFormDialog title={initial ? `แก้ไขห้อง ${initial.code}` : "เพิ่มห้องเรียน"} onClose={onClose} onSubmit={submit} saving={saving} errors={errors}>
      <FormGrid>
        <Field label="รหัสห้อง" required error={errors.code}>
          {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น IT4" autoFocus />}
        </Field>
        <Field label="ชื่อห้อง" required error={errors.name}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="ความจุ (คน)" required error={errors.capacity}>
          {(id) => <NumberInput id={id} min={1} value={capacity} onChange={setCapacity} />}
        </Field>
        <Field label="ประเภทห้อง" required error={errors.type}>
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as RoomType)}>
              {(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => (
                <option key={t} value={t}>
                  {ROOM_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </FormGrid>
      <Field label="อุปกรณ์ในห้อง" error={errors.equipment}>
        {(id) => <TagInput id={id} value={equipment} onChange={setEquipment} suggestions={lk.equipment} />}
      </Field>
      <FormSection title="ช่วงเวลาที่ห้องใช้ไม่ได้" description="เช่น ซ่อมบำรุง หรือหน่วยงานอื่นใช้">
        <SlotPicker time={dataset.time} value={unavailable} onChange={setUnavailable} label="ช่วงเวลาที่ห้องใช้ไม่ได้" />
      </FormSection>
    </EntityFormDialog>
  );
}
