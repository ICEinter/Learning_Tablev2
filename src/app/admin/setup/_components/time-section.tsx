"use client";
import { useState } from "react";
import { Alert, Button, Card, Checkbox, DataTable, Input, useToast } from "@/components/ui";
import { errorMessage, hasErrors, type FieldErrors } from "@/components/data/form-utils";
import { useData } from "@/lib/store/data-context";
import { TimeStructureSchema, formatZodIssues } from "@/shared/schemas";
import { toMinutes } from "@/shared/slots";
import type { DayDef, Period, TimeStructure } from "@/shared/types";

function addMinutes(hhmm: string, minutes: number): string {
  const ok = /^\d{2}:\d{2}$/.test(hhmm);
  const total = Math.min(23 * 60 + 59, (ok ? toMinutes(hhmm) : 8 * 60) + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-0.5 text-xs text-danger">{msg}</p> : null;
}

export function TimeSection({ initial }: { initial: TimeStructure }) {
  const { saveSettings, timetables } = useData();
  const toast = useToast();
  const [days, setDays] = useState<DayDef[]>(initial.days);
  const [periods, setPeriods] = useState<Period[]>(initial.periods);
  const [pre, setPre] = useState(initial.preActivity ?? null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const setDay = (i: number, patch: Partial<DayDef>) => setDays((xs) => xs.map((d, n) => (n === i ? { ...d, ...patch } : d)));
  const setPeriod = (i: number, patch: Partial<Period>) => setPeriods((xs) => xs.map((p, n) => (n === i ? { ...p, ...patch } : p)));

  const addPeriod = () =>
    setPeriods((xs) => {
      const last = xs[xs.length - 1];
      const start = last ? last.end : "08:30";
      return [...xs, { no: xs.length + 1, start, end: addMinutes(start, 60) }];
    });

  const dirty = JSON.stringify(days) !== JSON.stringify(initial.days) || JSON.stringify(periods) !== JSON.stringify(initial.periods);
  const draftCount = timetables.filter((t) => t.status !== "archived").length;

  const submit = async () => {
    const time: TimeStructure = {
      days: days.map((d) => ({ ...d, label: d.label.trim(), short: d.short.trim() })),
      periods: periods.map((p, i) => ({
        no: i + 1,
        start: p.start,
        end: p.end,
        ...(p.isBreak ? { isBreak: true } : {}),
        ...(p.label?.trim() ? { label: p.label.trim() } : {}),
      })),
      ...(pre ? { preActivity: { label: pre.label.trim(), start: pre.start, end: pre.end } } : {}),
    };
    const r = TimeStructureSchema.safeParse(time);
    const errs: FieldErrors = {};
    if (!r.success) for (const i of formatZodIssues(r.error)) errs[i.path || "_form"] ??= i.message;
    if (pre && pre.end > (periods[0]?.start ?? "99:99")) errs["preActivity.end"] ??= "กิจกรรมก่อนคาบแรกต้องจบก่อนคาบ 1 เริ่ม";
    setErrors(errs);
    if (hasErrors(errs)) return;
    setSaving(true);
    try {
      await saveSettings({ time });
      toast("บันทึกโครงสร้างเวลาแล้ว", "ok");
    } catch (e) {
      toast(`บันทึกไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setSaving(false);
    }
  };

  const errCount = Object.keys(errors).length;

  return (
    <Card
      title="โครงสร้างเวลา"
      actions={
        <Button variant="primary" size="sm" loading={saving} onClick={submit}>
          บันทึก
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {(dirty || draftCount > 0) && (
          <Alert tone="warn" title="ข้อควรระวัง">
            การเปลี่ยนวันหรือคาบเรียนอาจทำให้ตารางสอนที่มีอยู่ ({timetables.length} ฉบับ) ไม่ถูกต้อง เช่น คาบที่ถูกลบหรือกลายเป็นคาบพัก — ควรตรวจหรือจัดตารางใหม่หลังบันทึก
          </Alert>
        )}
        {errCount > 0 && (
          <Alert tone="danger" title={`ข้อมูลไม่ถูกต้อง ${errCount} จุด`}>
            {errors._form ?? errors.days ?? errors.periods ?? "กรุณาแก้ไขช่องที่มีข้อความสีแดง"}
          </Alert>
        )}

        <section aria-labelledby="days-h" className="flex flex-col gap-2">
          <h3 id="days-h" className="text-sm font-semibold">
            วันในสัปดาห์
          </h3>
          <DataTable>
            <thead>
              <tr>
                <th scope="col">วัน</th>
                <th scope="col">ชื่อเต็ม</th>
                <th scope="col">ชื่อย่อ</th>
                <th scope="col">เปิดจัดคาบ</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d.index}>
                  <td className="text-muted tabular-nums">{d.index + 1}</td>
                  <td>
                    <Input aria-label={`ชื่อเต็มวันที่ ${d.index + 1}`} className="min-w-[8rem]" value={d.label} onChange={(e) => setDay(i, { label: e.target.value })} />
                    <Err msg={errors[`days.${i}.label`]} />
                  </td>
                  <td>
                    <Input aria-label={`ชื่อย่อวันที่ ${d.index + 1}`} className="w-20" value={d.short} onChange={(e) => setDay(i, { short: e.target.value })} />
                    <Err msg={errors[`days.${i}.short`]} />
                  </td>
                  <td>
                    <Checkbox label={d.active ? "เปิด" : "ปิด"} checked={d.active} onChange={(v) => setDay(i, { active: v })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>

        <section aria-labelledby="periods-h" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="periods-h" className="text-sm font-semibold">
              คาบเรียน ({periods.length} คาบ/วัน)
            </h3>
            <div className="flex gap-2">
              <Button size="sm" onClick={addPeriod} disabled={periods.length >= 30}>
                + เพิ่มคาบท้าย
              </Button>
              <Button size="sm" variant="danger" onClick={() => setPeriods((xs) => xs.slice(0, -1))} disabled={periods.length <= 1}>
                ลบคาบสุดท้าย
              </Button>
            </div>
          </div>
          <DataTable>
            <thead>
              <tr>
                <th scope="col">คาบ</th>
                <th scope="col">เริ่ม</th>
                <th scope="col">สิ้นสุด</th>
                <th scope="col">คาบพัก</th>
                <th scope="col">ป้ายกำกับ</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => (
                <tr key={i} className={p.isBreak ? "bg-hatch" : undefined}>
                  <td className="font-medium tabular-nums">{i + 1}</td>
                  <td>
                    <Input type="time" aria-label={`เวลาเริ่มคาบ ${i + 1}`} className="w-32" value={p.start} onChange={(e) => setPeriod(i, { start: e.target.value })} />
                    <Err msg={errors[`periods.${i}.start`]} />
                  </td>
                  <td>
                    <Input type="time" aria-label={`เวลาสิ้นสุดคาบ ${i + 1}`} className="w-32" value={p.end} onChange={(e) => setPeriod(i, { end: e.target.value })} />
                    <Err msg={errors[`periods.${i}.end`]} />
                  </td>
                  <td>
                    <Checkbox label="พัก" checked={Boolean(p.isBreak)} onChange={(v) => setPeriod(i, { isBreak: v })} />
                  </td>
                  <td>
                    <Input aria-label={`ป้ายกำกับคาบ ${i + 1}`} className="min-w-[8rem]" value={p.label ?? ""} onChange={(e) => setPeriod(i, { label: e.target.value })} placeholder={p.isBreak ? "เช่น พักกลางวัน" : ""} />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <p className="text-xs text-muted">คาบพักห้ามจัดคาบเรียน และคาบต่อเนื่องจะไม่คร่อมคาบพัก</p>
        </section>

        <section aria-labelledby="pre-h" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="pre-h" className="text-sm font-semibold">
              กิจกรรมก่อนคาบแรก
            </h3>
            {pre ? (
              <Button size="sm" variant="danger" onClick={() => setPre(null)}>
                นำออก
              </Button>
            ) : (
              <Button size="sm" onClick={() => setPre({ label: "กิจกรรมหน้าเสาธง", start: "08:00", end: periods[0]?.start ?? "08:30" })}>
                + เพิ่มกิจกรรมก่อนคาบแรก
              </Button>
            )}
          </div>
          {pre ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem_9rem]">
              <div>
                <label className="text-sm font-medium" htmlFor="pre-label">
                  ชื่อกิจกรรม
                </label>
                <Input id="pre-label" value={pre.label} onChange={(e) => setPre({ ...pre, label: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="pre-start">
                  เริ่ม
                </label>
                <Input id="pre-start" type="time" value={pre.start} onChange={(e) => setPre({ ...pre, start: e.target.value })} />
                <Err msg={errors["preActivity.start"]} />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="pre-end">
                  สิ้นสุด
                </label>
                <Input id="pre-end" type="time" value={pre.end} onChange={(e) => setPre({ ...pre, end: e.target.value })} />
                <Err msg={errors["preActivity.end"]} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">ไม่มี (แสดงเป็นคอลัมน์แนวตั้งในตารางสอนเมื่อกำหนด)</p>
          )}
        </section>
      </div>
    </Card>
  );
}
