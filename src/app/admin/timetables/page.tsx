"use client";
/**
 * /admin/timetables — รายการเวอร์ชันตาราง (ร่าง/เผยแพร่/เก็บถาวร), เผยแพร่, ทำสำเนา, เปลี่ยนชื่อ, ลบ, เปรียบเทียบ
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { SOFT_KEYS, SOFT_LABEL, validate } from "@/engine";
import type { Score } from "@/engine/types";
import { useData } from "@/lib/store/data-context";
import type { TimetableVersion } from "@/shared/types";
import { Badge, Button, Card, Checkbox, DataTable, Dialog, EmptyState, Field, Input, PageHeader, useToast } from "@/components/ui";
import { ConfirmDialog } from "@/components/timetable/confirm-dialog";
import { duplicateAsDraft, formatDateTime, STATUS_TEXT, STATUS_TONE } from "@/components/timetable/utils";

const round1 = (n: number) => Math.round(n * 10) / 10;

export default function TimetablesPage() {
  const { dataset: ds, timetables, saveTimetable, deleteTimetable, publishTimetable } = useData();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<{ tt: TimetableVersion; label: string } | null>(null);
  const [publishing, setPublishing] = useState<TimetableVersion | null>(null);
  const [deleting, setDeleting] = useState<TimetableVersion | null>(null);

  const sorted = useMemo(() => [...timetables].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [timetables]);
  /** ตรวจใหม่ทุกเวอร์ชัน (ข้อมูลหลักอาจเปลี่ยนหลังสร้าง) */
  const scores = useMemo(() => {
    const m = new Map<string, Score>();
    for (const t of timetables) m.set(t.id, validate(ds, t.placements).score);
    return m;
  }, [ds, timetables]);

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => (on ? [...s.filter((x) => x !== id), id].slice(-2) : s.filter((x) => x !== id)));

  const duplicate = async (tt: TimetableVersion) => {
    await saveTimetable(duplicateAsDraft(tt));
    toast("ทำสำเนาเป็นร่างแล้ว", "ok");
  };

  const compare = selected.map((id) => timetables.find((t) => t.id === id)).filter((t): t is TimetableVersion => Boolean(t));

  return (
    <div className="space-y-5">
      <PageHeader
        title="ตารางเรียน/สอน"
        description="รายการเวอร์ชันตาราง เผยแพร่ได้เฉพาะฉบับที่ไม่มีข้อขัดแย้ง Hard"
        actions={
          <Link href="/admin/solve" className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
            จัดตารางใหม่
          </Link>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState title="ยังไม่มีตาราง">
          <Link href="/admin/solve" className="text-accent underline">
            ไปหน้าจัดตารางอัตโนมัติ
          </Link>{" "}
          เพื่อสร้างตารางร่างฉบับแรก
        </EmptyState>
      ) : (
        <>
          <DataTable>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">เลือกเพื่อเปรียบเทียบ</span>
                </th>
                <th scope="col">ชื่อเวอร์ชัน</th>
                <th scope="col">สถานะ</th>
                <th scope="col">สร้างเมื่อ</th>
                <th scope="col">อัลกอริทึม</th>
                <th scope="col" className="!text-right">
                  Hard
                </th>
                <th scope="col" className="!text-right">
                  Soft
                </th>
                <th scope="col">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((tt) => {
                const sc = scores.get(tt.id);
                const hard = sc?.hard ?? tt.metrics?.hard ?? 0;
                const soft = sc?.soft ?? tt.metrics?.soft ?? 0;
                return (
                  <tr key={tt.id}>
                    <td>
                      <Checkbox
                        label={<span className="sr-only">เปรียบเทียบ {tt.label}</span>}
                        checked={selected.includes(tt.id)}
                        onChange={(v) => toggle(tt.id, v)}
                      />
                    </td>
                    <td className="min-w-48">
                      <Link href={`/admin/timetables/${tt.id}`} className="font-medium text-accent hover:underline">
                        {tt.label}
                      </Link>
                      {tt.note && <div className="text-xs text-muted">{tt.note}</div>}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[tt.status]}>{STATUS_TEXT[tt.status]}</Badge>
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(tt.createdAt)}</td>
                    <td className="whitespace-nowrap">
                      {tt.source.algorithm}
                      {tt.source.seed !== undefined && <span className="text-muted"> · seed {tt.source.seed}</span>}
                    </td>
                    <td className="text-right tabular-nums">
                      <span className={hard ? "font-semibold text-danger" : "text-ok"}>{hard}</span>
                    </td>
                    <td className="text-right tabular-nums">{round1(soft)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Link
                          href={`/admin/timetables/${tt.id}`}
                          className="inline-flex h-8 items-center rounded-md border border-line px-2.5 text-sm hover:border-accent hover:text-accent"
                        >
                          เปิด
                        </Link>
                        <Button size="sm" onClick={() => duplicate(tt)}>
                          ทำสำเนาเป็นร่าง
                        </Button>
                        <Button size="sm" onClick={() => setRenaming({ tt, label: tt.label })}>
                          เปลี่ยนชื่อ
                        </Button>
                        {tt.status !== "published" && (
                          <Button size="sm" variant="primary" onClick={() => setPublishing(tt)} title={hard ? `มี Hard ${hard} รายการ` : undefined}>
                            เผยแพร่
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={tt.status === "published"}
                          title={tt.status === "published" ? "ลบฉบับที่เผยแพร่อยู่ไม่ได้" : undefined}
                          onClick={() => setDeleting(tt)}
                        >
                          ลบ
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>

          <Card title="เปรียบเทียบเวอร์ชัน">
            {compare.length < 2 ? (
              <p className="text-sm text-muted">เลือก 2 เวอร์ชันจากช่องทำเครื่องหมายด้านซ้ายเพื่อเปรียบเทียบคะแนน (เลือกแล้ว {compare.length}/2)</p>
            ) : (
              <CompareTable versions={compare} scores={scores} />
            )}
          </Card>
        </>
      )}

      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="เปลี่ยนชื่อเวอร์ชัน"
        footer={
          <>
            <Button onClick={() => setRenaming(null)}>ยกเลิก</Button>
            <Button
              variant="primary"
              disabled={!renaming?.label.trim()}
              onClick={async () => {
                if (!renaming) return;
                await saveTimetable({ ...renaming.tt, label: renaming.label.trim(), updatedAt: new Date().toISOString() });
                toast("เปลี่ยนชื่อแล้ว", "ok");
                setRenaming(null);
              }}
            >
              บันทึก
            </Button>
          </>
        }
      >
        {renaming && (
          <Field label="ชื่อเวอร์ชัน" required>
            {(id) => <Input id={id} value={renaming.label} maxLength={120} onChange={(e) => setRenaming({ ...renaming, label: e.target.value })} />}
          </Field>
        )}
      </Dialog>

      <ConfirmDialog
        open={publishing !== null}
        title="ยืนยันการเผยแพร่"
        confirmLabel="เผยแพร่"
        onClose={() => setPublishing(null)}
        onConfirm={async () => {
          if (!publishing) return;
          const r = await publishTimetable(publishing.id);
          toast(r.message, r.ok ? "ok" : "danger");
          setPublishing(null);
        }}
      >
        เผยแพร่ &quot;{publishing?.label}&quot; ให้ครูและนักเรียนเห็น? ฉบับที่เผยแพร่อยู่เดิมจะถูกเก็บถาวร
        {publishing && (scores.get(publishing.id)?.hard ?? 0) > 0 && (
          <p className="mt-2 text-danger">ตารางนี้ยังมีข้อขัดแย้ง Hard {scores.get(publishing.id)?.hard} รายการ — ระบบจะไม่อนุญาตให้เผยแพร่</p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        title="ยืนยันการลบ"
        confirmLabel="ลบ"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteTimetable(deleting.id);
          setSelected((s) => s.filter((x) => x !== deleting.id));
          toast("ลบเวอร์ชันแล้ว", "ok");
          setDeleting(null);
        }}
      >
        ลบ &quot;{deleting?.label}&quot; ถาวร? การกระทำนี้ย้อนกลับไม่ได้
      </ConfirmDialog>
    </div>
  );
}

function CompareTable({ versions, scores }: { versions: TimetableVersion[]; scores: Map<string, Score> }) {
  const [a, b] = versions;
  const sa = scores.get(a.id);
  const sb = scores.get(b.id);
  if (!sa || !sb) return null;
  const rows: { label: string; va: number; vb: number }[] = [
    { label: "Hard (ข้อขัดแย้งบังคับ)", va: sa.hard, vb: sb.hard },
    { label: "Soft (คะแนนถ่วงน้ำหนัก)", va: sa.soft, vb: sb.soft },
    ...SOFT_KEYS.map((k) => ({ label: SOFT_LABEL[k], va: sa.breakdown[k] ?? 0, vb: sb.breakdown[k] ?? 0 })),
  ];
  return (
    <DataTable>
      <thead>
        <tr>
          <th scope="col">ตัวชี้วัด (ยิ่งน้อยยิ่งดี)</th>
          <th scope="col" className="!text-right">
            {a.label}
          </th>
          <th scope="col" className="!text-right">
            {b.label}
          </th>
          <th scope="col" className="!text-right">
            ผลต่าง (ขวา − ซ้าย)
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const d = round1(r.vb - r.va);
          return (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className={`text-right tabular-nums ${r.va < r.vb ? "font-semibold text-ok" : ""}`}>{round1(r.va)}</td>
              <td className={`text-right tabular-nums ${r.vb < r.va ? "font-semibold text-ok" : ""}`}>{round1(r.vb)}</td>
              <td className={`text-right tabular-nums ${d > 0 ? "text-danger" : d < 0 ? "text-ok" : "text-muted"}`}>{d > 0 ? `+${d}` : d}</td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
