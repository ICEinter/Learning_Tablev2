"use client";
/**
 * SlotPicker — กริด วัน × คาบ สำหรับเลือกช่วงเวลา (ไม่ว่าง / ขอเลี่ยง)
 * - คาบพักและวันที่ปิดใช้งานเลือกไม่ได้
 * - คีย์บอร์ด: ลูกศรเลื่อน, Home/End ต้น/ท้ายแถว, Space/Enter สลับ (roving tabindex)
 */
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";
import { periodTimeLabel, slotKey } from "@/shared/slots";
import type { SlotRef, TimeStructure } from "@/shared/types";

export function SlotPicker({
  time,
  value,
  onChange,
  tone = "danger",
  label,
}: {
  time: TimeStructure;
  value: SlotRef[];
  onChange: (v: SlotRef[]) => void;
  tone?: "danger" | "warn";
  /** ใช้เป็น aria-label ของกริด */
  label: string;
}) {
  const days = useMemo(() => [...time.days].sort((a, b) => a.index - b.index), [time.days]);
  const periods = time.periods;
  const P = periods.length;
  const selected = useMemo(() => new Set(value.map(slotKey)), [value]);
  const [focus, setFocus] = useState({ r: 0, c: 0 });
  const cells = useRef<(HTMLButtonElement | null)[]>([]);

  const enabled = (r: number, c: number) => Boolean(days[r]?.active && !periods[c]?.isBreak);

  const toggle = (r: number, c: number) => {
    if (!enabled(r, c)) return;
    const ref = { day: days[r].index, period: periods[c].no };
    const k = slotKey(ref);
    onChange(selected.has(k) ? value.filter((v) => slotKey(v) !== k) : [...value, ref]);
  };

  const toggleDay = (r: number) => {
    const day = days[r];
    if (!day.active) return;
    const open = periods.filter((p) => !p.isBreak);
    const all = open.every((p) => selected.has(slotKey({ day: day.index, period: p.no })));
    const rest = value.filter((v) => v.day !== day.index);
    onChange(all ? rest : [...rest, ...open.map((p) => ({ day: day.index, period: p.no }))]);
  };

  const move = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(days.length - 1, r));
    const nc = Math.max(0, Math.min(P - 1, c));
    setFocus({ r: nr, c: nc });
    cells.current[nr * P + nc]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) => {
    const map: Record<string, [number, number]> = {
      ArrowRight: [r, c + 1],
      ArrowLeft: [r, c - 1],
      ArrowDown: [r + 1, c],
      ArrowUp: [r - 1, c],
      Home: [r, 0],
      End: [r, P - 1],
    };
    const next = map[e.key];
    if (next) {
      e.preventDefault();
      move(next[0], next[1]);
    }
  };

  const onCls = tone === "danger" ? "bg-danger-soft text-danger border-danger/40" : "bg-warn-soft text-warn border-warn/40";
  const mark = tone === "danger" ? "✕" : "−";

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-line">
        <table role="grid" aria-label={label} className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-page px-2 py-1 text-left font-semibold">
                วัน \ คาบ
              </th>
              {periods.map((p) => (
                <th key={p.no} scope="col" title={periodTimeLabel(p)} className="min-w-9 bg-page px-1 py-1 text-center font-semibold">
                  {p.isBreak ? (p.label ?? "พัก") : p.no}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, r) => (
              <tr key={d.index}>
                <th scope="row" className="sticky left-0 z-10 border-t border-line bg-surface px-1 py-0.5 text-left font-medium">
                  <button
                    type="button"
                    disabled={!d.active}
                    onClick={() => toggleDay(r)}
                    title={d.active ? `สลับทั้ง${d.label}` : `${d.label} (ปิดใช้งาน)`}
                    className="w-full rounded px-1 py-1 text-left hover:bg-accent-soft disabled:text-muted/60 disabled:hover:bg-transparent"
                  >
                    {d.short}
                  </button>
                </th>
                {periods.map((p, c) => {
                  const on = selected.has(slotKey({ day: d.index, period: p.no }));
                  const ok = enabled(r, c);
                  const isFocus = focus.r === r && focus.c === c;
                  return (
                    <td key={p.no} className="border-t border-l border-line p-0.5">
                      <button
                        type="button"
                        ref={(el) => {
                          cells.current[r * P + c] = el;
                        }}
                        tabIndex={isFocus ? 0 : -1}
                        aria-pressed={on}
                        aria-disabled={!ok}
                        aria-label={`${d.label} คาบ ${p.no} (${periodTimeLabel(p)})${ok ? "" : " — เลือกไม่ได้"}`}
                        onClick={() => toggle(r, c)}
                        onFocus={() => setFocus({ r, c })}
                        onKeyDown={(e) => onKeyDown(e, r, c)}
                        className={cx(
                          "flex h-8 w-full min-w-8 items-center justify-center rounded border font-semibold",
                          !ok ? "cursor-not-allowed border-transparent bg-hatch text-muted" : on ? onCls : "border-transparent hover:border-accent hover:bg-accent-soft",
                        )}
                      >
                        {on ? mark : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>เลือก {value.length} ช่อง</span>
        <span>คลิกชื่อวันเพื่อเลือกทั้งวัน · ใช้ลูกศรเลื่อนและ Space เพื่อสลับ · ช่องลายทแยง = คาบพัก/วันปิด</span>
        {value.length > 0 && (
          <button type="button" className="text-accent hover:underline" onClick={() => onChange([])}>
            ล้างทั้งหมด
          </button>
        )}
      </div>
    </div>
  );
}
