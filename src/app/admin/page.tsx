"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, PageHeader, Stat } from "@/components/ui";
import { precheck, validate } from "@/engine";
import { useData } from "@/lib/store/data-context";
import { useSession } from "@/lib/auth/session-context";
import { checkDataset, entityLabel } from "@/shared/integrity";
import { effectivePeriods, termLabel } from "@/shared/slots";
import type { EntityKind } from "@/shared/types";

const STEPS = [
  { href: "/admin/setup", title: "ตั้งค่าปี/ภาค/เวลา", desc: "วันเรียน คาบ เวลา กิจกรรมหน้าเสาธง" },
  { href: "/admin/import", title: "นำเข้าข้อมูล", desc: "CSV/Excel พร้อมพรีวิวและตรวจข้อมูล" },
  { href: "/admin/data", title: "ตรวจ/แก้ข้อมูลหลัก", desc: "รายวิชา ครู ห้อง กลุ่ม การมอบหมายสอน" },
  { href: "/admin/solve", title: "จัดตารางอัตโนมัติ", desc: "Heuristic, GA หรือ Agent" },
  { href: "/admin/timetables", title: "ตรวจ แก้ไข เผยแพร่", desc: "ตรวจชนก่อนบันทึก แยกร่าง/เผยแพร่" },
  { href: "/admin/reports", title: "รายงานและ Export", desc: "PDF / Excel / พิมพ์" },
];

export default function AdminDashboard() {
  const { dataset, timetables, published } = useData();
  const { mode: authMode } = useSession();
  const [showAll, setShowAll] = useState(false);

  const issues = useMemo(() => checkDataset(dataset), [dataset]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const proofs = useMemo(() => precheck(dataset), [dataset]);

  const demand = useMemo(() => {
    const course = new Map(dataset.courses.map((c) => [c.id, c]));
    return dataset.assignments.reduce((s, a) => s + effectivePeriods(a, course.get(a.courseId)), 0);
  }, [dataset]);
  const activeDays = dataset.time.days.filter((d) => d.active).length;
  const teachable = dataset.time.periods.filter((p) => !p.isBreak).length;

  const latestDraft = timetables.find((t) => t.status === "draft");
  const current = published ?? latestDraft;
  const currentScore = useMemo(() => (current ? validate(dataset, current.placements).score : null), [current, dataset]);

  const counts: [EntityKind, number][] = [
    ["courses", dataset.courses.length],
    ["teachers", dataset.teachers.length],
    ["rooms", dataset.rooms.length],
    ["groups", dataset.groups.length],
    ["students", dataset.students.length],
    ["assignments", dataset.assignments.length],
  ];

  return (
    <div>
      <PageHeader
        title="แดชบอร์ด"
        description={`${dataset.school.name} · ภาคเรียน ${termLabel(dataset)}`}
        actions={
          <Link href="/admin/solve">
            <Button variant="primary">จัดตารางอัตโนมัติ</Button>
          </Link>
        }
      />

      {authMode === "demo" && (
        <div className="mb-4">
          <Alert tone="warn" title="โหมดสาธิต — ข้อมูลสังเคราะห์">
            ข้อมูลตัวอย่างมีครู {dataset.teachers.length.toLocaleString()} คน นักเรียน {dataset.students.length.toLocaleString()} คน ใน {dataset.groups.length.toLocaleString()} กลุ่ม
            ข้อมูลและตารางที่บันทึกจะอยู่ในเบราว์เซอร์นี้ ใช้ทดสอบจัดตารางได้โดยไปที่{" "}
            <Link className="font-semibold underline" href="/admin/solve">จัดตารางอัตโนมัติ</Link>
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {counts.map(([k, n]) => (
          <Link key={k} href={`/admin/data?tab=${k}`} className="block">
            <Stat label={entityLabel(k)} value={n.toLocaleString()} />
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="คาบที่ต้องจัด/สัปดาห์" value={demand.toLocaleString()} hint={`จาก ${dataset.assignments.length} รายการมอบหมายสอน`} />
        <Stat label="ช่องเวลาต่อกลุ่ม/สัปดาห์" value={(activeDays * teachable).toLocaleString()} hint={`${activeDays} วัน × ${teachable} คาบ`} />
        <Stat
          label="ข้อมูลผิดพลาด / คำเตือน"
          value={`${errors.length} / ${warnings.length}`}
          tone={errors.length ? "danger" : warnings.length ? "warn" : "ok"}
        />
        <Stat
          label={published ? "ตารางเผยแพร่: Hard / Soft" : latestDraft ? "ร่างล่าสุด: Hard / Soft" : "ตาราง"}
          value={currentScore ? `${currentScore.hard} / ${currentScore.soft.toFixed(0)}` : "ยังไม่มี"}
          tone={currentScore ? (currentScore.hard === 0 ? "ok" : "danger") : "neutral"}
          hint={published ? <Badge tone="ok">เผยแพร่แล้ว</Badge> : latestDraft ? <Badge>ร่าง</Badge> : "ยังไม่ได้จัดตาราง"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="ขั้นตอนการทำงาน">
          <ol className="grid gap-2 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.href}>
                <Link href={s.href} className="flex gap-3 rounded-md border border-line p-3 hover:border-accent">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</span>
                  <span>
                    <span className="block text-sm font-medium">{s.title}</span>
                    <span className="block text-xs text-muted">{s.desc}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="ตรวจสอบก่อนจัดตาราง (Pre-check)">
          {proofs.length === 0 ? (
            <p className="text-sm text-ok">ไม่พบหลักฐานว่าข้อมูลจัดตารางไม่ได้</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {proofs.map((p, i) => (
                <li key={i} className="rounded border border-danger/30 bg-danger-soft px-3 py-2">
                  <Badge tone="danger">{p.rule}</Badge> {p.message}
                  <span className="text-muted"> (ต้องการ {p.required} / มี {p.available})</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card title={`ข้อผิดพลาดและคำเตือนของข้อมูล (${issues.length})`}>
          {issues.length === 0 ? (
            <p className="text-sm text-ok">ข้อมูลครบถ้วนและถูกต้องตามที่ตรวจได้</p>
          ) : (
            <>
              <ul className="space-y-1.5 text-sm">
                {(showAll ? issues : issues.slice(0, 12)).map((i, k) => (
                  <li key={k} className="flex gap-2">
                    <Badge tone={i.level === "error" ? "danger" : "warn"}>{i.level === "error" ? "ผิดพลาด" : "คำเตือน"}</Badge>
                    <span>
                      {i.entity !== "time" && i.entity !== "school" ? (
                        <Link href={`/admin/data?tab=${i.entity}`} className="text-accent underline">
                          {entityLabel(i.entity)}
                        </Link>
                      ) : (
                        <Link href="/admin/setup" className="text-accent underline">
                          โครงสร้างเวลา
                        </Link>
                      )}{" "}
                      {i.message}
                    </span>
                  </li>
                ))}
              </ul>
              {issues.length > 12 && (
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowAll((x) => !x)}>
                  {showAll ? "แสดงน้อยลง" : `แสดงทั้งหมด ${issues.length} รายการ`}
                </Button>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
