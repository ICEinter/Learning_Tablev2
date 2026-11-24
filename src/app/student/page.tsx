"use client";
import { useState } from "react";
import { useSession } from "@/lib/auth/session-context";
import { useData } from "@/lib/store/data-context";
import { PageHeader, Tabs } from "@/components/ui";
import { PublishedTimetable } from "@/components/timetable/published-timetable";

export default function StudentPage() {
  const { session } = useSession();
  const { dataset: ds, published } = useData();
  const groupIds = session?.groupIds ?? [];
  const [sel, setSel] = useState<string>("me");
  const current = sel === "me" || groupIds.includes(sel) ? sel : "me";

  const student = ds.students.find((s) => s.id === session?.studentId);
  const primaryGroup = student ? ds.groups.find((g) => g.id === student.groupId) : null;

  const items = [
    { value: "me", label: "ตารางเรียนของฉัน" },
    ...groupIds.map((g) => ({
      value: g,
      label: `กลุ่ม ${ds.groups.find((x) => x.id === g)?.code ?? g}`,
    })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="ตารางเรียนของฉัน"
        description={
          student
            ? `ตารางเรียนสำหรับ ${student.displayName} (${student.code}) · ${primaryGroup ? `กลุ่ม ${primaryGroup.code} (${primaryGroup.name})` : ""}`
            : "ตารางเรียนจากตารางฉบับเผยแพร่ (รวมกลุ่มเรียนและวิชาที่ลงทะเบียนเพิ่ม)"
        }
      />

      {/* Student Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="text-xs text-muted block">รหัสประจำตัว</span>
          <span className="text-base sm:text-lg font-bold text-accent mt-1 block">
            {student?.code || session?.studentId || "นักเรียน"}
          </span>
          <span className="text-[11px] text-muted block mt-0.5">
            {student?.displayName || session?.displayName}
          </span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="text-xs text-muted block">กลุ่มเรียนหลัก</span>
          <span className="text-base sm:text-lg font-bold text-ink mt-1 block">
            {primaryGroup?.code || "ไม่ระบุกลุ่ม"}
          </span>
          <span className="text-[11px] text-muted block mt-0.5">
            {primaryGroup?.name || "สายการเรียน"}
          </span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="text-xs text-muted block">วิชาเรียนเพิ่มเติม</span>
          <span className="text-base sm:text-lg font-bold text-ink mt-1 block">
            {student?.extraAssignmentIds.length || 0} <span className="text-xs font-normal text-muted">วิชา</span>
          </span>
          <span className="text-[11px] text-ok block mt-0.5">ลงทะเบียนข้ามกลุ่ม</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="text-xs text-muted block">สถานะตารางเรียน</span>
          <span className="text-base sm:text-lg font-bold text-ink mt-1 flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                published ? "bg-ok animate-pulse" : "bg-warn"
              }`}
            />
            {published ? "เผยแพร่แล้ว" : "รอเผยแพร่"}
          </span>
          <span className="text-[11px] text-muted block mt-0.5">
            {published ? published.label : "กำลังจัดทำ"}
          </span>
        </div>
      </div>

      {items.length > 1 && <Tabs value={current} onChange={setSel} items={items} />}

      {current === "me" ? (
        <PublishedTimetable kind="student" entityId={session?.studentId} showSummary={false} />
      ) : (
        <PublishedTimetable kind="group" entityId={current} showSummary={false} />
      )}
    </div>
  );
}
