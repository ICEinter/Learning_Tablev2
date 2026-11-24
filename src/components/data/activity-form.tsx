"use client";
import { useMemo, useState } from "react";
import { Alert, Checkbox, Field, Input, Select } from "@/components/ui";
import { newId } from "@/lib/id";
import { useData } from "@/lib/store/data-context";
import { ActivitySchema } from "@/shared/schemas";
import { periodTimeLabel, teacherName } from "@/shared/slots";
import type { LockedActivity } from "@/shared/types";
import { EntityFormDialog, FormGrid, FormSection, useEntitySave } from "./entity-form-dialog";
import { hasErrors, schemaErrors, toNumber, type FieldErrors } from "./form-utils";
import { MultiSelect } from "./multi-select";
import { NumberInput } from "./number-input";

export function ActivityForm({ initial, onClose }: { initial: LockedActivity | null; onClose: () => void }) {
  const { dataset } = useData();
  const { time } = dataset;
  const { save, saving } = useEntitySave("activities");
  const [errors, setErrors] = useState<FieldErrors>({});
  const firstActive = time.days.find((d) => d.active)?.index ?? 0;
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [day, setDay] = useState(String(initial?.day ?? firstActive));
  const [startPeriod, setStartPeriod] = useState(String(initial?.startPeriod ?? 1));
  const [length, setLength] = useState(String(initial?.length ?? 1));
  const [appliesToAll, setAppliesToAll] = useState(initial?.appliesToAll ?? false);
  const [teacherIds, setTeacherIds] = useState<string[]>(initial?.teacherIds ?? []);
  const [groupIds, setGroupIds] = useState<string[]>(initial?.groupIds ?? []);
  const [roomId, setRoomId] = useState(initial?.roomId ?? "");
  const [countsAsLoad, setCountsAsLoad] = useState(initial?.countsAsLoad ?? true);

  const teacherOptions = useMemo(() => dataset.teachers.map((t) => ({ value: t.id, label: teacherName(t), hint: t.code })), [dataset.teachers]);
  const groupOptions = useMemo(() => dataset.groups.map((g) => ({ value: g.id, label: `${g.code} · ${g.name}` })), [dataset.groups]);

  const start = toNumber(startPeriod);
  const len = toNumber(length);
  const covered = time.periods.filter((p) => p.no >= start && p.no < start + len);
  const coversBreak = covered.some((p) => p.isBreak);
  const dayDef = time.days.find((d) => d.index === Number(day));

  const submit = async () => {
    const item: LockedActivity = {
      id: initial?.id ?? newId("act"),
      code: code.trim(),
      name: name.trim(),
      day: Number(day),
      startPeriod: start,
      length: len,
      appliesToAll,
      teacherIds: appliesToAll ? [] : teacherIds,
      groupIds: appliesToAll ? [] : groupIds,
      roomId: roomId || undefined,
      countsAsLoad,
    };
    const errs = schemaErrors(ActivitySchema, item);
    if (!errs["length"] && !Number.isNaN(start) && !Number.isNaN(len) && start + len - 1 > time.periods.length)
      errs.length = `เกินจำนวนคาบต่อวัน (มี ${time.periods.length} คาบ)`;
    setErrors(errs);
    if (hasErrors(errs)) return;
    if (await save(item, !initial)) onClose();
  };

  return (
    <EntityFormDialog title={initial ? `แก้ไขกิจกรรม ${initial.code}` : "เพิ่มกิจกรรมล็อกเวลา"} onClose={onClose} onSubmit={submit} saving={saving} errors={errors}>
      <FormGrid>
        <Field label="รหัส/ชื่อย่อกิจกรรม" required error={errors.code} hint="เช่น Home Room, PLC">
          {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />}
        </Field>
        <Field label="ชื่อกิจกรรม" required error={errors.name}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
      </FormGrid>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="วัน" required error={errors.day}>
          {(id) => (
            <Select id={id} value={day} onChange={(e) => setDay(e.target.value)}>
              {time.days.map((d) => (
                <option key={d.index} value={d.index}>
                  {d.label}
                  {d.active ? "" : " (ปิด)"}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="คาบเริ่ม" required error={errors.startPeriod}>
          {(id) => (
            <Select id={id} value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)}>
              {time.periods.map((p) => (
                <option key={p.no} value={p.no}>
                  คาบ {p.no} ({periodTimeLabel(p)}){p.isBreak ? " พัก" : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="จำนวนคาบ" required error={errors.length}>
          {(id) => <NumberInput id={id} min={1} max={time.periods.length} value={length} onChange={setLength} />}
        </Field>
      </div>
      {covered.length > 0 && (
        <p className="text-sm text-muted">
          ช่วงเวลา: {dayDef?.label} {covered[0].start} – {covered[covered.length - 1].end}
        </p>
      )}
      {dayDef && !dayDef.active && <Alert tone="warn">วันที่เลือกปิดใช้งานในโครงสร้างเวลา</Alert>}
      {coversBreak && <Alert tone="warn">ช่วงกิจกรรมคร่อมคาบพัก</Alert>}

      <FormSection title="ผู้เข้าร่วม">
        <Checkbox label="ทุกกลุ่มเรียนและครูทุกคน" checked={appliesToAll} onChange={setAppliesToAll} />
        {!appliesToAll && (
          <FormGrid>
            <Field label="กลุ่มเรียน" error={errors.groupIds}>
              {(id) => <MultiSelect id={id} options={groupOptions} value={groupIds} onChange={setGroupIds} placeholder="ค้นหากลุ่ม" />}
            </Field>
            <Field label="ครู" error={errors.teacherIds}>
              {(id) => <MultiSelect id={id} options={teacherOptions} value={teacherIds} onChange={setTeacherIds} placeholder="ค้นหาครู" />}
            </Field>
          </FormGrid>
        )}
      </FormSection>
      <FormGrid>
        <Field label="สถานที่" error={errors.roomId}>
          {(id) => (
            <Select id={id} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {dataset.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox label="นับเป็นชั่วโมงในสรุปภาระ" checked={countsAsLoad} onChange={setCountsAsLoad} />
        </div>
      </FormGrid>
    </EntityFormDialog>
  );
}
