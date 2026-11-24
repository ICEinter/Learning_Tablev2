"use client";
import { cx } from "@/components/ui";

export const STEPS = ["เลือกประเภท", "อัปโหลดไฟล์", "จับคู่คอลัมน์", "ตรวจสอบ", "ยืนยันบันทึก"] as const;

export function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="mb-5 flex gap-1 overflow-x-auto pb-1" aria-label="ขั้นตอนการนำเข้า">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={cx(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                state === "done" && "border-ok bg-ok-soft text-ok",
                state === "current" && "border-accent bg-accent text-white",
                state === "todo" && "border-line bg-surface text-muted",
              )}
            >
              {state === "done" ? "✓" : n}
            </span>
            <span className={cx("hidden truncate text-sm sm:inline", state === "current" ? "font-semibold text-ink" : "text-muted")}>{label}</span>
            {n < STEPS.length && <span className="hidden h-px flex-1 bg-line md:block" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
