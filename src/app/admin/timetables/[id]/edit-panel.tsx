"use client";
/**
 * โหมดแก้ไขตารางร่าง: เลือกคาบ → แสดงช่องที่วางได้ (moveTargets) → เลือกห้อง (ถ้ามีหลายห้อง)
 * → ย้ายในสำเนาทำงาน → ตรวจซ้ำ (validate) → บันทึกได้เมื่อ Hard = 0 เท่านั้น
 */
import { useMemo, useState } from "react";
import { evaluateMove, moveTargets } from "@/engine";
import type { ValidationResult } from "@/engine/types";
import type { TimetableGrid } from "@/lib/timetable/viewmodel";
import type { Dataset, TimetableVersion } from "@/shared/types";
import { Alert, Badge, Button, Dialog, Field, Select, useToast } from "@/components/ui";
import { TimetableGridView } from "@/components/timetable/timetable-grid";
import type { useTimetableEditor } from "@/components/timetable/use-timetable-editor";
import { slotKey, type BlockRef, type TargetInfo } from "@/components/timetable/utils";

type Editor = ReturnType<typeof useTimetableEditor>;

function fmtDelta(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "±0";
  return r > 0 ? `+${r}` : `${r}`;
}

export function EditPanel({
  ds,
  tt,
  editor,
  validation,
  baseScore,
  grid,
  saveTimetable,
  onExit,
}: {
  ds: Dataset;
  tt: TimetableVersion;
  editor: Editor;
  validation: ValidationResult;
  baseScore: ValidationResult["score"];
  grid: TimetableGrid;
  saveTimetable: (tt: TimetableVersion) => Promise<void>;
  onExit: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<BlockRef | null>(null);
  const [pending, setPending] = useState<{ day: number; period: number; rooms: string[]; roomId: string } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const placements = editor.placements;

  const targets = useMemo(() => {
    if (!selected) return null;
    const m = new Map<string, TargetInfo>();
    for (const t of moveTargets(ds, placements, selected.assignmentId, selected.block)) {
      m.set(slotKey(t.day, t.period), { ok: t.okRoomIds.length > 0, reasons: t.reasons, okRoomIds: t.okRoomIds });
    }
    return m;
  }, [ds, placements, selected]);

  const validCount = useMemo(() => (targets ? [...targets.values()].filter((t) => t.ok).length : 0), [targets]);
  const roomCode = (id: string) => ds.rooms.find((r) => r.id === id)?.code ?? id;
  const current = selected ? placements.find((p) => p.assignmentId === selected.assignmentId && p.block === selected.block) : undefined;
  const selectedLabel = useMemo(() => {
    if (!selected) return "";
    const a = ds.assignments.find((x) => x.id === selected.assignmentId);
    const c = a ? ds.courses.find((x) => x.id === a.courseId) : undefined;
    return `${c?.code ?? selected.assignmentId} ${c?.name ?? ""} (ช่วงที่ ${selected.block + 1})`;
  }, [ds, selected]);

  const doMove = (day: number, period: number, roomId: string) => {
    if (!selected) return;
    const ev = evaluateMove(ds, placements, selected.assignmentId, selected.block, { day, period, roomId });
    if (!ev.ok) {
      toast(`ย้ายไม่ได้: ${ev.reasons.join(" / ") || "ขัดกับเงื่อนไข"}`, "danger");
      return;
    }
    editor.move({ assignmentId: selected.assignmentId, block: selected.block, day, period, roomId });
    setSelected(null);
    setPending(null);
    setBlocked(false);
    toast("ย้ายคาบแล้ว (ยังไม่บันทึก)", "accent");
  };

  const onTarget = (day: number, period: number) => {
    const t = targets?.get(slotKey(day, period));
    if (!t?.ok) {
      toast(t?.reasons.join(" / ") || "วางที่นี่ไม่ได้", "warn");
      return;
    }
    if (t.okRoomIds.length === 1) {
      doMove(day, period, t.okRoomIds[0]);
      return;
    }
    const prefer = current && t.okRoomIds.includes(current.roomId) ? current.roomId : t.okRoomIds[0];
    setPending({ day, period, rooms: t.okRoomIds, roomId: prefer });
  };

  const save = async () => {
    if (validation.score.hard > 0) {
      setBlocked(true);
      return;
    }
    setSaving(true);
    try {
      await saveTimetable({
        ...tt,
        placements,
        updatedAt: new Date().toISOString(),
        metrics: { ...tt.metrics, hard: validation.score.hard, soft: validation.score.soft },
      });
      toast("บันทึกตารางแล้ว", "ok");
      setSelected(null);
      onExit();
    } catch (e) {
      toast(`บันทึกไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`, "danger");
    } finally {
      setSaving(false);
    }
  };

  const cancelAll = () => {
    editor.reset();
    setSelected(null);
    setBlocked(false);
    onExit();
  };

  const hard = validation.score.hard;
  const soft = validation.score.soft;
  const hardList = validation.violations.filter((v) => v.severity === "hard");

  return (
    <div className="space-y-3">
      <div className="no-print sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-md border border-accent/30 bg-accent-soft px-3 py-2 text-sm">
        <span className="font-semibold text-accent">โหมดแก้ไข</span>
        <Badge tone={hard ? "danger" : "ok"}>
          Hard {hard} ({fmtDelta(hard - baseScore.hard)})
        </Badge>
        <Badge tone="warn">
          Soft {Math.round(soft * 10) / 10} ({fmtDelta(soft - baseScore.soft)})
        </Badge>
        <span className="text-muted">แก้ไข {editor.changes} ครั้ง</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={editor.undo} disabled={!editor.canUndo} aria-label="ย้อนกลับ">
            ↶ ย้อนกลับ
          </Button>
          <Button size="sm" onClick={editor.redo} disabled={!editor.canRedo} aria-label="ทำซ้ำ">
            ↷ ทำซ้ำ
          </Button>
          <Button size="sm" variant="danger" onClick={cancelAll}>
            ยกเลิกการแก้ไข
          </Button>
          <Button size="sm" variant="primary" onClick={save} loading={saving} disabled={!editor.dirty}>
            บันทึก
          </Button>
        </div>
      </div>

      <p className="no-print text-sm text-muted" aria-live="polite">
        {selected
          ? `เลือก ${selectedLabel} — ช่องสีฟ้าคือคาบเริ่มต้นที่วางได้ (${validCount} ช่อง) แตะช่องอื่นเพื่อดูเหตุผลที่วางไม่ได้ หรือแตะคาบเดิมเพื่อยกเลิก`
          : "แตะ (หรือลาก) คาบสอนที่ต้องการย้าย ระบบจะแสดงช่องที่วางได้"}
      </p>

      {blocked && hard > 0 && (
        <Alert tone="danger" title={`บันทึกไม่ได้: ยังมีข้อขัดแย้ง Hard ${hard} รายการ`}>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {hardList.slice(0, 8).map((v, i) => (
              <li key={i}>{v.message}</li>
            ))}
            {hardList.length > 8 && <li>… และอีก {hardList.length - 8} รายการ</li>}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={editor.undo} disabled={!editor.canUndo}>
              ย้อนกลับการย้ายล่าสุด
            </Button>
            <Button size="sm" variant="danger" onClick={cancelAll}>
              ยกเลิกการแก้ไขทั้งหมด
            </Button>
          </div>
        </Alert>
      )}

      <TimetableGridView
        grid={grid}
        school={ds.school}
        violations={validation.violations}
        showHeader={false}
        showSignatures={false}
        edit={{
          selected,
          targets,
          onSelect: setSelected,
          onTarget,
          onInvalid: (r) => toast(`วางไม่ได้: ${r}`, "warn"),
        }}
      />

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="เลือกห้อง"
        footer={
          <>
            <Button onClick={() => setPending(null)}>ยกเลิก</Button>
            <Button variant="primary" onClick={() => pending && doMove(pending.day, pending.period, pending.roomId)}>
              ย้าย
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-3 text-sm">
            <p>
              {ds.time.days.find((d) => d.index === pending.day)?.label} คาบ {pending.period} — มีห้องที่ใช้ได้ {pending.rooms.length} ห้อง
            </p>
            <Field label="ห้อง">
              {(id) => (
                <Select id={id} value={pending.roomId} onChange={(e) => setPending({ ...pending, roomId: e.target.value })}>
                  {pending.rooms.map((r) => (
                    <option key={r} value={r}>
                      {roomCode(r)}
                      {current?.roomId === r ? " (ห้องเดิม)" : ""}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
