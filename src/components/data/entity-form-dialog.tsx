"use client";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Dialog, useToast } from "@/components/ui";
import { useData } from "@/lib/store/data-context";
import type { EntityKind, EntityOf } from "@/shared/types";
import { errorMessage, type FieldErrors } from "./form-utils";

/** บันทึก 1 รายการ พร้อม toast */
export function useEntitySave<K extends EntityKind>(kind: K) {
  const { upsert } = useData();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const save = async (item: EntityOf<K>, isNew: boolean): Promise<boolean> => {
    setSaving(true);
    try {
      await upsert(kind, [item]);
      toast(isNew ? "เพิ่มข้อมูลแล้ว" : "บันทึกการแก้ไขแล้ว", "ok");
      return true;
    } catch (e) {
      toast(`บันทึกไม่สำเร็จ: ${errorMessage(e)}`, "danger");
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { save, saving };
}

/** กรอบ Dialog สำหรับฟอร์มเพิ่ม/แก้ไข (ปุ่มบันทึกอยู่ใน footer และ submit ฟอร์มผ่าน form id) */
export function EntityFormDialog({
  title,
  onClose,
  onSubmit,
  saving,
  errors,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  errors: FieldErrors;
  children: ReactNode;
}) {
  const formId = useId();
  const count = Object.keys(errors).length;
  const handle = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button type="button" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            บันทึก
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handle} noValidate className="flex flex-col gap-4">
        {count > 0 && (
          <Alert tone="danger" title={`ข้อมูลไม่ถูกต้อง ${count} ช่อง`}>
            {errors._form ?? "กรุณาแก้ไขช่องที่มีข้อความสีแดง"}
          </Alert>
        )}
        {children}
      </form>
    </Dialog>
  );
}

/** กริดฟอร์ม 1 คอลัมน์ (มือถือ) / 2 คอลัมน์ (sm ขึ้นไป) */
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

export function FormSection({ title, children, description }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {description && <p className="text-xs text-muted">{description}</p>}
      {children}
    </fieldset>
  );
}
