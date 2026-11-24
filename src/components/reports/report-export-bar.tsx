"use client";
import { useState } from "react";
import type { ReportTable } from "@/lib/reports/types";
import { safeFileName } from "@/lib/timetable/overview";
import type { SchoolInfo } from "@/shared/types";
import { Button, useToast } from "@/components/ui";

type Action = "preview" | "pdf" | "xlsx" | "xlsxAll";

/** แถบส่งออกรายงาน (PDF/Excel ของแถวที่กรองแล้ว + Excel ทุกรายงาน + พิมพ์) */
export function ReportExportBar({
  school,
  termLabel,
  current,
  all,
  fileBase,
}: {
  school: SchoolInfo;
  termLabel: string;
  current: () => ReportTable[];
  all?: () => ReportTable[];
  fileBase: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);

  async function run(action: Action) {
    setBusy(action);
    try {
      const reports = action === "xlsxAll" ? (all?.() ?? []) : current();
      if (reports.length === 0) {
        toast("ไม่มีรายงานให้ส่งออก", "warn");
        return;
      }
      const base = safeFileName(action === "xlsxAll" ? `รายงานทั้งหมด-${termLabel}` : fileBase);
      if (action === "xlsx" || action === "xlsxAll") {
        const m = await import("@/lib/export/excel");
        await m.exportReportExcel(reports, { fileName: `${base}.xlsx`, download: true });
      } else {
        const m = await import("@/lib/export/pdf");
        await m.exportReportPdf(reports, { school, termLabel, fileName: `${base}.pdf`, output: action === "preview" ? "open" : "download" });
      }
      if (action !== "preview") toast("ส่งออกไฟล์แล้ว", "ok");
    } catch (e) {
      toast(`ส่งออกไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`, "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2" role="group" aria-label="ส่งออกรายงาน">
      <Button size="sm" loading={busy === "preview"} disabled={busy !== null} onClick={() => run("preview")}>
        พรีวิว PDF
      </Button>
      <Button size="sm" variant="primary" loading={busy === "pdf"} disabled={busy !== null} onClick={() => run("pdf")}>
        PDF
      </Button>
      <Button size="sm" loading={busy === "xlsx"} disabled={busy !== null} onClick={() => run("xlsx")}>
        Excel
      </Button>
      {all && (
        <Button size="sm" loading={busy === "xlsxAll"} disabled={busy !== null} onClick={() => run("xlsxAll")}>
          Excel ทุกรายงาน
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => window.print()}>
        พิมพ์
      </Button>
    </div>
  );
}
