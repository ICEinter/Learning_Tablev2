"use client";
import { useState } from "react";
import type { TimetableGrid } from "@/lib/timetable/viewmodel";
import { safeFileName } from "@/lib/timetable/overview";
import type { SchoolInfo } from "@/shared/types";
import { Button, useToast } from "@/components/ui";

type Action = "preview" | "pdf" | "pdfAll" | "xlsx" | "xlsxAll";

/**
 * แถบส่งออกตาราง: พรีวิว PDF / ดาวน์โหลด PDF / PDF ทั้งหมด / Excel / พิมพ์
 * โหลดโมดูล export แบบ dynamic import เมื่อกดเท่านั้น
 */
export function TimetableExportBar({
  school,
  current,
  all,
  fileBase,
  allFileBase,
  allLabel = "ทั้งหมด",
}: {
  school: SchoolInfo;
  /** ตารางที่แสดงอยู่ */
  current: () => TimetableGrid | null;
  /** ทุก entity ของมุมมองปัจจุบัน (ไม่ระบุ = ไม่มีปุ่ม "ทั้งหมด") */
  all?: () => TimetableGrid[];
  /** ชื่อไฟล์ไม่รวมนามสกุล เช่น ตารางสอน-T05-2_2569 */
  fileBase: string;
  allFileBase?: string;
  allLabel?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);

  async function run(action: Action) {
    setBusy(action);
    try {
      const many = action === "pdfAll" || action === "xlsxAll";
      const grids = many ? (all?.() ?? []) : [current()].filter((g): g is TimetableGrid => g !== null);
      if (grids.length === 0) {
        toast("ไม่มีตารางให้ส่งออก", "warn");
        return;
      }
      const base = safeFileName(many ? (allFileBase ?? `${fileBase}-ทั้งหมด`) : fileBase);
      if (action === "xlsx" || action === "xlsxAll") {
        const m = await import("@/lib/export/excel");
        await m.exportTimetableExcel(grids, { school, fileName: `${base}.xlsx`, download: true });
      } else {
        const m = await import("@/lib/export/pdf");
        await m.exportTimetablePdf(grids, { school, fileName: `${base}.pdf`, output: action === "preview" ? "open" : "download" });
      }
      if (action !== "preview") toast("ส่งออกไฟล์แล้ว", "ok");
    } catch (e) {
      toast(`ส่งออกไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`, "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2" role="group" aria-label="ส่งออกตาราง">
      <Button size="sm" variant="secondary" loading={busy === "preview"} disabled={busy !== null} onClick={() => run("preview")}>
        พรีวิว PDF
      </Button>
      <Button size="sm" variant="primary" loading={busy === "pdf"} disabled={busy !== null} onClick={() => run("pdf")}>
        ดาวน์โหลด PDF
      </Button>
      {all && (
        <Button size="sm" variant="secondary" loading={busy === "pdfAll"} disabled={busy !== null} onClick={() => run("pdfAll")}>
          PDF {allLabel}
        </Button>
      )}
      <Button size="sm" variant="secondary" loading={busy === "xlsx"} disabled={busy !== null} onClick={() => run("xlsx")}>
        Excel
      </Button>
      {all && (
        <Button size="sm" variant="secondary" loading={busy === "xlsxAll"} disabled={busy !== null} onClick={() => run("xlsxAll")}>
          Excel {allLabel}
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => window.print()}>
        พิมพ์
      </Button>
    </div>
  );
}
