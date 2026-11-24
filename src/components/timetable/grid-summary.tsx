import type { GridStats } from "@/lib/timetable/viewmodel";

/** ชิปสรุปภาระจาก stats ของตาราง */
export function GridSummary({ stats, className }: { stats: GridStats; className?: string }) {
  const items: { label: string; value: string }[] = [
    { label: "คาบสอน", value: `${stats.teachingPeriods} คาบ/สัปดาห์` },
    { label: "กิจกรรม", value: `${stats.activityPeriods} คาบ` },
    { label: "คาบว่าง (คั่น)", value: `${stats.freePeriods} คาบ` },
    { label: "คาบต่อเนื่อง", value: `${stats.consecutiveBlocks} ช่วง` },
    { label: "สูงสุด/วัน", value: `${stats.maxPerDay} คาบ` },
    { label: "ในเวลา / นอกเวลา", value: `${stats.inRegular} / ${stats.outRegular}` },
  ];
  return (
    <ul aria-label="สรุปภาระ" className={["flex flex-wrap gap-2 text-sm print:gap-1 print:text-[8pt]", className].filter(Boolean).join(" ")}>
      {items.map((it) => (
        <li key={it.label} className="rounded-full border border-line bg-surface px-3 py-1">
          <span className="text-muted">{it.label}: </span>
          <span className="font-semibold tabular-nums">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}
