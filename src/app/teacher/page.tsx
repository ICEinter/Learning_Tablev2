"use client";
import { useMemo, useState } from "react";
import { useSession } from "@/lib/auth/session-context";
import { useData } from "@/lib/store/data-context";
import { PageHeader, Select } from "@/components/ui";
import { PublishedTimetable } from "@/components/timetable/published-timetable";
import { teacherName } from "@/shared/slots";
import { Icon } from "@/components/icons";

export default function TeacherPage() {
  const { session } = useSession();
  const { dataset: ds, published } = useData();

  // จัดการเลือกรหัสครู: ถ้าผูกไว้แล้วใช้ของตนเอง ถ้ายังไม่ผูกสามารถเลือกดูได้
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (session?.teacherId && ds.teachers.some((t) => t.id === session.teacherId)) {
      return session.teacherId;
    }
    return ds.teachers[0]?.id || "";
  });

  const teacher = useMemo(
    () => ds.teachers.find((t) => t.id === selectedTeacherId),
    [ds.teachers, selectedTeacherId],
  );

  // คำนวณสถิติของครูจาก assignments
  const stats = useMemo(() => {
    if (!teacher) return null;
    const assignments = ds.assignments.filter((a) => a.teacherId === teacher.id);
    const totalPeriods = assignments.reduce((sum, a) => sum + (a.periodsPerWeek ?? 0), 0);
    const uniqueCourseIds = new Set(assignments.map((a) => a.courseId));
    const uniqueGroupIds = new Set(assignments.flatMap((a) => a.groupIds));

    return {
      totalPeriods,
      courseCount: uniqueCourseIds.size,
      groupCount: uniqueGroupIds.size,
      targetLoad: teacher.maxPerWeek ?? 18,
    };
  }, [teacher, ds.assignments]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          title="ตารางสอนของฉัน"
          description={
            teacher
              ? `ตารางสอนสำหรับ ${teacherName(teacher)} (${teacher.code}) · แผนก ${teacher.department || "วิชาการ"}`
              : "ตารางสอนและสรุปภาระสอนจากตารางฉบับเผยแพร่"
          }
        />

        {/* Dropdown กรณีผู้ใช้ต้องการดูครูท่านอื่น หรือยังไม่ได้ผูก teacherId */}
        {ds.teachers.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted whitespace-nowrap">เลือกครู:</span>
            <Select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="text-xs py-1.5 min-w-[200px]"
            >
              {ds.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {teacherName(t)} ({t.code})
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Teacher Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <span className="text-xs text-muted block">ภาระสอนรวม</span>
            <span className="text-xl sm:text-2xl font-bold text-accent mt-1 block">
              {stats.totalPeriods} <span className="text-xs font-normal text-muted">คาบ/สัปดาห์</span>
            </span>
            <span className="text-[11px] text-muted block mt-0.5">
              เป้าหมาย: {stats.targetLoad} คาบ
            </span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <span className="text-xs text-muted block">จำนวนรายวิชา</span>
            <span className="text-xl sm:text-2xl font-bold text-ink mt-1 block">
              {stats.courseCount} <span className="text-xs font-normal text-muted">วิชา</span>
            </span>
            <span className="text-[11px] text-ok block mt-0.5">รับผิดชอบหลัก</span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <span className="text-xs text-muted block">กลุ่มเรียนที่สอน</span>
            <span className="text-xl sm:text-2xl font-bold text-ink mt-1 block">
              {stats.groupCount} <span className="text-xs font-normal text-muted">กลุ่ม</span>
            </span>
            <span className="text-[11px] text-muted block mt-0.5">ในภาคเรียนนี้</span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <span className="text-xs text-muted block">สถานะตาราง</span>
            <span className="text-base sm:text-lg font-bold text-ink mt-1 flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  published ? "bg-ok animate-pulse" : "bg-warn"
                }`}
              />
              {published ? "เผยแพร่แล้ว" : "รอการเผยแพร่"}
            </span>
            <span className="text-[11px] text-muted block mt-0.5">
              {published ? published.label : "ฉบับร่างกำลังจัดทำ"}
            </span>
          </div>
        </div>
      )}

      {/* Main Timetable View */}
      <PublishedTimetable kind="teacher" entityId={selectedTeacherId} />
    </div>
  );
}
