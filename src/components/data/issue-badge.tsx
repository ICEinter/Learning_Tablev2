"use client";
import { Badge } from "@/components/ui";
import type { DataIssue } from "@/shared/integrity";

/** แสดงปัญหาของแถวจาก checkDataset — คลิกเพื่อขยายรายละเอียด */
export function IssueBadge({ issues }: { issues: DataIssue[] }) {
  if (!issues.length) return <Badge tone="ok">✓ ปกติ</Badge>;
  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.length - errors;
  return (
    <details className="max-w-xs">
      <summary
        className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"
        title={issues.map((i) => i.message).join("\n")}
      >
        <Badge tone={errors ? "danger" : "warn"}>
          {errors ? `✕ ผิดพลาด ${errors}` : `⚠ คำเตือน ${warnings}`}
          {errors > 0 && warnings > 0 ? ` · เตือน ${warnings}` : ""}
        </Badge>
      </summary>
      <ul className="mt-1 space-y-1 text-xs">
        {issues.map((i, n) => (
          <li key={n} className={i.level === "error" ? "text-danger" : "text-warn"}>
            {i.level === "error" ? "✕" : "⚠"} {i.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
