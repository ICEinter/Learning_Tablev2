"use client";
import { useMemo, useState } from "react";
import type { Violation } from "@/engine/types";
import { Badge, Input, Select, cx } from "@/components/ui";

type SevFilter = "all" | "hard" | "soft";

/** รายการข้อขัดแย้ง (Hard ก่อน) กรองได้ คลิกเพื่อโฟกัสมุมมองที่เกี่ยวข้อง */
export function ViolationsPanel({
  violations,
  dayLabel,
  onFocus,
  maxHeight = "max-h-[28rem]",
}: {
  violations: Violation[];
  dayLabel: (day: number) => string;
  onFocus?: (v: Violation) => void;
  maxHeight?: string;
}) {
  const [sev, setSev] = useState<SevFilter>("all");
  const [text, setText] = useState("");
  const hard = violations.filter((v) => v.severity === "hard").length;
  const soft = violations.length - hard;

  const list = useMemo(() => {
    const q = text.trim().toLowerCase();
    return violations
      .filter((v) => sev === "all" || v.severity === sev)
      .filter((v) => !q || v.message.toLowerCase().includes(q) || String(v.type).toLowerCase().includes(q))
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "hard" ? -1 : 1));
  }, [violations, sev, text]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={hard ? "danger" : "ok"}>Hard {hard}</Badge>
        <Badge tone={soft ? "warn" : "ok"}>Soft {soft}</Badge>
      </div>
      <div className="grid grid-cols-[8rem_1fr] gap-2">
        <Select aria-label="กรองระดับ" value={sev} onChange={(e) => setSev(e.target.value as SevFilter)}>
          <option value="all">ทั้งหมด</option>
          <option value="hard">Hard</option>
          <option value="soft">Soft</option>
        </Select>
        <Input aria-label="ค้นหาข้อขัดแย้ง" placeholder="ค้นหา…" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{violations.length === 0 ? "ไม่พบข้อขัดแย้ง ✓" : "ไม่พบรายการตามตัวกรอง"}</p>
      ) : (
        <ul className={cx("space-y-1 overflow-y-auto pr-1", maxHeight)}>
          {list.slice(0, 300).map((v, i) => {
            const when = v.slots
              .slice(0, 3)
              .map((s) => `${dayLabel(s.day)} คาบ ${s.period}`)
              .join(", ");
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={!onFocus}
                  onClick={() => onFocus?.(v)}
                  className="flex w-full items-start gap-2 rounded-md border border-line px-2 py-1.5 text-left text-sm hover:border-accent disabled:hover:border-line"
                >
                  <Badge tone={v.severity === "hard" ? "danger" : "warn"} className="shrink-0">
                    {v.severity === "hard" ? "Hard" : "Soft"}
                  </Badge>
                  <span className="min-w-0">
                    <span className="block break-words">{v.message}</span>
                    {when && (
                      <span className="block text-xs text-muted">
                        {when}
                        {v.slots.length > 3 ? " …" : ""}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {list.length > 300 && <li className="text-center text-xs text-muted">แสดง 300 จาก {list.length} รายการ</li>}
        </ul>
      )}
    </div>
  );
}
