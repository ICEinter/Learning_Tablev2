"use client";
import { useState } from "react";
import type { TimetableGrid } from "@/lib/timetable/viewmodel";
import { safeFileName } from "@/lib/timetable/overview";
import type { SchoolInfo } from "@/shared/types";
import { Button, useToast } from "@/components/ui";
import { uploadToFirebaseStorage } from "@/lib/firebase/storage-service";

type Action = "preview" | "pdf" | "pdfAll" | "xlsx" | "xlsxAll" | "cloudUpload";

/**
 * แถบส่งออกตาราง: พรีวิว PDF / ดาวน์โหลด PDF / PDF ทั้งหมด / Excel / อัปโหลดขึ้น Firebase Storage / พิมพ์
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
  current: () => TimetableGrid | null;
  all?: () => TimetableGrid[];
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

      if (action === "cloudUpload") {
        const pdfModule = await import("@/lib/export/pdf");
        const blob = await pdfModule.exportTimetablePdf(grids, { school, fileName: `${base}.pdf`, output: "blob" });
        if (blob) {
          const rec = await uploadToFirebaseStorage({
            file: blob,
            filename: `${base}.pdf`,
            category: "timetable_pdf",
            contentType: "application/pdf",
          });
          toast(`บันทึกลง Firebase Storage สำเร็จ (${rec.name})`, "ok");
        }
      } else if (action === "xlsx" || action === "xlsxAll") {
        const m = await import("@/lib/export/excel");
        await m.exportTimetableExcel(grids, { school, fileName: `${base}.xlsx`, download: true });
        toast("ส่งออกไฟล์ Excel แล้ว", "ok");
      } else {
        const m = await import("@/lib/export/pdf");
        await m.exportTimetablePdf(grids, { school, fileName: `${base}.pdf`, output: action === "preview" ? "open" : "download" });
        if (action !== "preview") toast("ส่งออกไฟล์ PDF แล้ว", "ok");
      }
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
      <Button
        size="sm"
        variant="secondary"
        className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
        loading={busy === "cloudUpload"}
        disabled={busy !== null}
        onClick={() => run("cloudUpload")}
        title="อัปโหลดตารางขึ้น Firebase Cloud Storage และบันทึกประวัติลง collection storage_files"
      >
        ☁️ บันทึกลง Storage
      </Button>
      <Button size="sm" variant="ghost" onClick={() => window.print()}>
        พิมพ์
      </Button>
    </div>
  );
}