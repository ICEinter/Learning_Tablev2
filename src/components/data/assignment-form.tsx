"use client";
import { useMemo, useState } from "react";
import { Alert, Badge, Field, Input, Select } from "@/components/ui";
import { newId } from "@/lib/id";
import { useData } from "@/lib/store/data-context";
import { AssignmentSchema } from "@/shared/schemas";
import { teacherName } from "@/shared/slots";
import { ROOM_TYPE_LABEL, type Assignment } from "@/shared/types";
import { EntityFormDialog, FormGrid, FormSection, useEntitySave } from "./entity-form-dialog";
import { hasErrors, parseNumberList, schemaErrors, toOptionalNumber, type FieldErrors } from "./form-utils";
import { fittingRooms, useLookups } from "./lookups";
import { MultiSelect } from "./multi-select";
import { BlockSumHint, NumberInput } from "./number-input";

export function AssignmentForm({ initial, onClose }: { initial: Assignment | null; onClose: () => void }) {
  const { dataset } = useData();
  const lk = useLookups();
  const { save, saving } = useEntitySave("assignments");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [courseId, setCourseId] = useState(initial?.courseId ?? "");
  const [teacherId, setTeacherId] = useState(initial?.teacherId ?? "");
  const [groupIds, setGroupIds] = useState<string[]>(initial?.groupIds ?? []);
  const [ppw, setPpw] = useState(initial?.periodsPerWeek !== undefined ? String(initial.periodsPerWeek) : "");
  const [blocks, setBlocks] = useState(initial?.blockSizes?.join(",") ?? "");
  const [fixedRoomId, setFixedRoomId] = useState(initial?.fixedRoomId ?? "");

  const course = lk.courseById.get(courseId);
  const teacher = lk.teacherById.get(teacherId);
  const size = lk.groupSize(groupIds);
  const fits = useMemo(() => fittingRooms(dataset.rooms, course, size), [dataset.rooms, course, size]);

  const { qualifiedTeachers, otherTeachers } = useMemo(() => {
    const q = dataset.teachers.filter((t) => courseId && t.qualifiedCourseIds.includes(courseId));
    return { qualifiedTeachers: q, otherTeachers: dataset.teachers.filter((t) => !q.includes(t)) };
  }, [dataset.teachers, courseId]);
  const notQualified = Boolean(teacher && course && teacher.qualifiedCourseIds.length > 0 && !teacher.qualifiedCourseIds.includes(course.id));

  const groupOptions = useMemo(
    () => dataset.groups.map((g) => ({ value: g.id, label: `${g.code} · ${g.name}`, hint: `${g.level} · ${g.size} คน` })),
    [dataset.groups],
  );

  const duplicate = dataset.assignments.find(
    (a) => a.id !== initial?.id && a.courseId === courseId && a.groupIds.length > 0 && a.groupIds.some((g) => groupIds.includes(g)),
  );
  const ppwNum = toOptionalNumber(ppw);
  const effectivePpw = ppwNum ?? course?.periodsPerWeek;
  const fixedRoom = fixedRoomId ? lk.roomById.get(fixedRoomId) : undefined;
  const fixedFits = !fixedRoom || fits.some((r) => r.id === fixedRoom.id);

  const submit = async () => {
    const blockList = parseNumberList(blocks);
    const item: Assignment = {
      id: initial?.id ?? newId("a"),
      courseId,
      teacherId,
      groupIds,
      periodsPerWeek: ppwNum,
      blockSizes: blockList && blockList.length ? blockList : undefined,
      fixedRoomId: fixedRoomId || undefined,
    };
    const errs = schemaErrors(AssignmentSchema, item);
    if (!courseId) errs.courseId = "ต้องเลือกรายวิชา";
    if (!teacherId) errs.teacherId = "ต้องเลือกครูผู้สอน";
    if (ppwNum !== undefined && (!Number.isInteger(ppwNum) || ppwNum < 1)) errs.periodsPerWeek = "ต้องเป็นจำนวนเต็มบวก";
    if (blockList === null) errs.blockSizes = "รูปแบบไม่ถูกต้อง ใช้จำนวนเต็มบวกคั่นด้วยจุลภาค เช่น 1,2";
    else if (blockList.length && effectivePpw !== undefined && blockList.reduce((s, n) => s + n, 0) !== effectivePpw)
      errs.blockSizes = `ผลรวมคาบต่อเนื่องต้องเท่ากับ ${effectivePpw} คาบ`;
    setErrors(errs);
    if (hasErrors(errs)) return;
    if (await save(item, !initial)) onClose();
  };

  return (
    <EntityFormDialog title={initial ? "แก้ไขการมอบหมายสอน" : "เพิ่มการมอบหมายสอน"} onClose={onClose} onSubmit={submit} saving={saving} errors={errors}>
      <FormGrid>
        <Field label="รายวิชา" required error={errors.courseId}>
          {(id) => (
            <Select id={id} value={courseId} onChange={(e) => setCourseId(e.target.value)} autoFocus>
              <option value="">— เลือกรายวิชา —</option>
              {dataset.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="ครูผู้สอน" required error={errors.teacherId} hint={courseId ? `มีครูที่ระบุว่าสอนวิชานี้ได้ ${qualifiedTeachers.length} คน` : undefined}>
          {(id) => (
            <Select id={id} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">— เลือกครู —</option>
              {qualifiedTeachers.length > 0 && (
                <optgroup label="✓ มีคุณสมบัติสอนวิชานี้">
                  {qualifiedTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {teacherName(t)} ({lk.teacherLoad.get(t.id) ?? 0}/{t.maxPerWeek})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={qualifiedTeachers.length ? "ครูอื่น ๆ" : "ครูทั้งหมด"}>
                {otherTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teacherName(t)} ({lk.teacherLoad.get(t.id) ?? 0}/{t.maxPerWeek})
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
        </Field>
      </FormGrid>
      {notQualified && (
        <Alert tone="warn" title="ครูไม่มีคุณสมบัติสอนวิชานี้">
          {teacher && teacherName(teacher)} ไม่มี {course?.code} ในรายวิชาที่สอนได้ — ระบบตรวจข้อมูลจะแจ้งเป็นข้อผิดพลาด แนะนำให้เลือกครูกลุ่มแรก หรือเพิ่มวิชาในข้อมูลครู
        </Alert>
      )}

      <Field label={`กลุ่มเรียน (รวม ${size} คน)`} required error={errors.groupIds} hint="เลือกหลายกลุ่มได้ถ้าเรียนร่วมกัน">
        {(id) => <MultiSelect id={id} options={groupOptions} value={groupIds} onChange={setGroupIds} placeholder="รหัสหรือชื่อกลุ่ม" />}
      </Field>
      {duplicate && (
        <Alert tone="warn">
          มีการมอบหมายสอนวิชานี้ให้กลุ่มเดียวกันอยู่แล้ว: {lk.assignmentLabel(duplicate)}
        </Alert>
      )}

      <FormSection title="กำหนดเฉพาะรายการนี้ (ไม่บังคับ)" description={course ? `ค่าจากรายวิชา: ${course.periodsPerWeek} คาบ แบ่งเป็น ${course.blockSizes.join(",")}` : "เว้นว่างเพื่อใช้ค่าจากรายวิชา"}>
        <FormGrid>
          <Field label="คาบต่อสัปดาห์" error={errors.periodsPerWeek}>
            {(id) => <NumberInput id={id} min={1} value={ppw} onChange={setPpw} placeholder={course ? String(course.periodsPerWeek) : ""} />}
          </Field>
          <Field label="การแบ่งคาบต่อเนื่อง" error={errors.blockSizes}>
            {(id) => (
              <>
                <Input id={id} value={blocks} onChange={(e) => setBlocks(e.target.value)} placeholder={course?.blockSizes.join(",") ?? "เช่น 1,2"} inputMode="numeric" />
                <BlockSumHint blocks={blocks} expected={effectivePpw} />
              </>
            )}
          </Field>
        </FormGrid>
        <Field label="บังคับห้อง" error={errors.fixedRoomId}>
          {(id) => (
            <Select id={id} value={fixedRoomId} onChange={(e) => setFixedRoomId(e.target.value)}>
              <option value="">— ให้ระบบเลือกห้องที่เหมาะสม —</option>
              {dataset.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.name} ({r.capacity} คน){fits.some((f) => f.id === r.id) ? " ✓" : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {fixedRoom && !fixedFits && course && (
          <Alert tone="warn">ห้อง {fixedRoom.code} ไม่ตรงเงื่อนไขของวิชา (ประเภท/ความจุ/อุปกรณ์) — ตรวจสอบอีกครั้งถ้าไม่ใช่การบังคับโดยตั้งใจ</Alert>
        )}
      </FormSection>

      {course && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">
            ห้องที่เหมาะสม ({fits.length}) — {ROOM_TYPE_LABEL[course.roomType]}, ความจุ ≥ {size}
            {course.requiredEquipment.length ? `, อุปกรณ์: ${course.requiredEquipment.join(", ")}` : ""}
          </p>
          {fits.length ? (
            <div className="flex flex-wrap gap-1.5">
              {fits.map((r) => (
                <Badge key={r.id} tone="ok">
                  ✓ {r.code} ({r.capacity})
                </Badge>
              ))}
            </div>
          ) : (
            <Alert tone="danger">ไม่มีห้องที่ตรงเงื่อนไข — ระบบจะจัดตารางรายการนี้ไม่ได้ (เพิ่มห้อง/อุปกรณ์ หรือบังคับห้อง)</Alert>
          )}
        </div>
      )}
    </EntityFormDialog>
  );
}
