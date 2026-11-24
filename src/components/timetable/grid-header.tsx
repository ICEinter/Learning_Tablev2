"use client";
import type { TimetableGrid } from "@/lib/timetable/viewmodel";
import type { SchoolInfo } from "@/shared/types";

const TITLE: Record<TimetableGrid["kind"], string> = {
  teacher: "ตารางสอนรายบุคคล",
  room: "ตารางการใช้ห้องเรียน/ห้องปฏิบัติการ",
  group: "ตารางเรียนกลุ่มผู้เรียน",
  student: "ตารางเรียนรายบุคคล",
  course: "ตารางรายวิชา",
};

/** ส่วนหัวตารางสอนทางการ 4 บรรทัดตามแบบฟอร์มวิทยาลัยเทคนิคระยอง */
export function GridHeader({ grid, school }: { grid: TimetableGrid; school?: SchoolInfo }) {
  const regular = grid.stats.inRegular;
  const outside = grid.stats.outRegular;
  const schoolName = school?.name || "วิทยาลัยเทคนิคระยอง";
  const deptName = school?.departmentName || "แผนกวิชาเทคโนโลยีสารสนเทศและการสื่อสาร";

  return (
    <div className="mb-3 space-y-3 print:mb-2 print:space-y-1">
      {/* หัวตาราง 4 บรรทัดแบบทางการ */}
      <div className="rounded-lg border border-line bg-page/50 p-3 text-center print:border-none print:p-0">
        <h2 className="text-lg font-bold text-ink print:text-[12pt]">{schoolName}</h2>
        <p className="text-sm font-semibold text-accent print:text-[9pt] print:text-ink">
          {TITLE[grid.kind]} ภาคเรียนที่ 2/2569
        </p>
        <p className="text-xs text-muted print:text-[8pt] print:text-ink">
          {deptName} (รหัส {school?.departmentCode || "901"})
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] print:grid-cols-[1fr_1.3fr] print:gap-2">
        {/* รายละเอียดผู้สอน / กลุ่มเรียน / ข้อมูลประจำตาราง */}
        <div className="min-w-0 rounded-lg border border-line bg-surface p-3 text-sm print:border-none print:p-0 print:text-[8pt]">
          <div className="border-b border-line pb-1.5 font-bold text-accent print:text-ink">
            {grid.title}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {grid.meta.map((m) => (
              <div key={m.label} className="contents">
                <dt className="font-medium text-muted">{m.label}:</dt>
                <dd className="min-w-0 break-words font-semibold text-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ตารางสรุปรายวิชา ท. ป. น. ช. */}
        <CourseSummaryTable grid={grid} regular={regular} outside={outside} />
      </div>
    </div>
  );
}

function num(v: number | null): string {
  return v === null ? "" : String(v);
}

export function CourseSummaryTable({ grid, regular, outside }: { grid: TimetableGrid; regular: number; outside: number }) {
  if (grid.summary.length === 0) return <div className="text-sm text-muted">ไม่มีรายวิชา</div>;
  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface p-2 print:border-none print:p-0">
      <table className="w-full border-collapse text-xs print:text-[7pt] [&_td]:border [&_td]:border-line [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:border [&_th]:border-line [&_th]:bg-page [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:font-semibold">
        <thead>
          <tr>
            <th scope="col">รหัสวิชา</th>
            <th scope="col" className="text-left">ชื่อรายวิชา</th>
            <th scope="col" title="ทฤษฎี">ท.</th>
            <th scope="col" title="ปฏิบัติ">ป.</th>
            <th scope="col" title="หน่วยกิต">น.</th>
            <th scope="col" title="ชั่วโมงต่อสัปดาห์">ช.</th>
          </tr>
        </thead>
        <tbody>
          {grid.summary.map((r) => (
            <tr key={r.code} className={r.isActivity ? "bg-activity" : undefined}>
              <td className="whitespace-nowrap text-center font-mono">{r.code}</td>
              <td title={r.detail}>
                {r.name}
                {r.detail && <span className="text-muted"> ({r.detail})</span>}
              </td>
              <td className="text-center tabular-nums">{num(r.theory)}</td>
              <td className="text-center tabular-nums">{num(r.practice)}</td>
              <td className="text-center tabular-nums">{num(r.credits)}</td>
              <td className="text-center font-semibold tabular-nums">{r.hours}</td>
            </tr>
          ))}
          <tr className="bg-page/50 font-bold">
            <td colSpan={2} className="text-right">
              รวม <span className="font-normal text-muted">(ในเวลา: {regular} ช.) (นอกเวลา: {outside} ช.)</span>
            </td>
            <td className="text-center tabular-nums">{grid.totals.theory}</td>
            <td className="text-center tabular-nums">{grid.totals.practice}</td>
            <td className="text-center tabular-nums">{grid.totals.credits}</td>
            <td className="text-center tabular-nums text-accent">{grid.totals.hours}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** แถวลงนามทางการ 4 ฝ่ายท้ายตารางสอนวิทยาลัยเทคนิคระยอง */
export function SignatureRow({ school }: { school: SchoolInfo }) {
  if (!school.signatories || school.signatories.length === 0) return null;
  return (
    <div className="mt-8 rounded-lg border border-line bg-surface p-4 print:mt-4 print:border-none print:p-0">
      <div className="grid grid-cols-2 gap-6 text-center text-sm sm:grid-cols-4 print:grid-cols-4 print:gap-2 print:text-[8pt]">
        {school.signatories.slice(0, 4).map((s, i) => (
          <div key={i} className="space-y-1">
            <div className="text-xs text-muted">ลงชื่อ......................................................</div>
            <div className="font-semibold text-ink">({s.name})</div>
            <div className="text-xs text-muted print:text-ink">{s.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}