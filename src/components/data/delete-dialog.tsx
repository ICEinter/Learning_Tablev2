"use client";
import { useMemo, useState } from "react";
import { Alert, Button, Dialog, useToast } from "@/components/ui";
import { useData } from "@/lib/store/data-context";
import { entityLabel } from "@/shared/integrity";
import type { EntityKind } from "@/shared/types";
import { errorMessage } from "./form-utils";
import { findReferences } from "./references";

const MAX_SHOWN = 15;

/** ยืนยันการลบ พร้อมตรวจการอ้างอิง (ถ้ายังถูกอ้างอิง จะลบไม่ได้และแสดงรายการที่อ้างอิง) */
export function DeleteDialog({ kind, target, onClose }: { kind: EntityKind; target: { id: string; label: string } | null; onClose: () => void }) {
  const { dataset, timetables, remove } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const refs = useMemo(
    () => (target ? findReferences(dataset, timetables, kind, target.id) : { blocking: [], warnings: [] }),
    [dataset, timetables, kind, target],
  );
  const blocked = refs.blocking.length > 0;

  const confirm = async () => {
    if (!target || blocked) return;
    setBusy(true);
    try {
      await remove(kind, [target.id]);
      toast(`ลบ${entityLabel(kind)} ${target.label} แล้ว`, "ok");
      onClose();
    } catch (e) {
      toast(`ลบไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={`ลบ${entityLabel(kind)}`}
      footer={
        <>
          <Button onClick={onClose}>{blocked ? "ปิด" : "ยกเลิก"}</Button>
          {!blocked && (
            <Button variant="danger" loading={busy} onClick={confirm}>
              ยืนยันการลบ
            </Button>
          )}
        </>
      }
    >
      {target && (
        <div className="flex flex-col gap-3 text-sm">
          {blocked ? (
            <Alert tone="danger" title={`ลบ "${target.label}" ไม่ได้ เพราะยังถูกอ้างอิงอยู่ ${refs.blocking.length} รายการ`}>
              <p className="mb-2">กรุณาแก้ไขหรือลบรายการต่อไปนี้ก่อน:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {refs.blocking.slice(0, MAX_SHOWN).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              {refs.blocking.length > MAX_SHOWN && <p className="mt-1 text-muted">และอีก {refs.blocking.length - MAX_SHOWN} รายการ</p>}
            </Alert>
          ) : (
            <p>
              ต้องการลบ <strong>{target.label}</strong> ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้
            </p>
          )}
          {refs.warnings.map((w, i) => (
            <Alert key={i} tone="warn">
              {w}
            </Alert>
          ))}
        </div>
      )}
    </Dialog>
  );
}
