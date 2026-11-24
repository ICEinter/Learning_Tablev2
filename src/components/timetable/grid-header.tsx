"use client";
import type { TimetableGrid } from "@/lib/timetable/viewmodel";
import type { SchoolInfo } from "@/shared/types";

const TITLE: Record<TimetableGrid["kind"], string> = {
  teacher: "ตารางสอน",
  room: "ตารางการใช้ห้อง",
  group: "ตารางเรียน",
  student: "ตารางเรียน",
  course: "ตารางรายวิชา",
};

/** ส่วนหัวตาราง: ซ้าย = ชื่อสถานศึกษา + ข้อมูล entity, ขวา = ตารางสรุปรายวิชา ท. ป. น. ช. */
export function GridHeader({ grid, school }: { grid: TimetableGrid; school?: SchoolInfo }) {
  const regular = grid.stats.inRegular;
  const outside = grid.stats.outRegular;
  return (
    <div className="mb-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] print:grid-cols-[1fr_1.3fr] print:gap-2 print:mb-1">
      <div className="min-w-0 text-sm print:text-[8pt]">
        {school && <div className="text-base font-semibold print:text-[10pt]">{school.name}</div>}
        <div className="font-semibold text-accent print:text-ink">
          {TITLE[grid.kind]} — {grid.title}
        </div>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {grid.meta.map((m) => (
            <div key={m.label} className="contents">
              <dt className="text-muted">{m.label}</dt>
              <dd className="min-w-0 break-words">{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <CourseSummaryTable grid={grid} regular={regular} outside={outside} />
    </div>
  );
}

function num(v: number | null): string {
  return v === null ? "" : String(v);
}

export function CourseSummaryTable({ grid, regular, outside }: { grid: TimetableGrid; regular: number; outside: number }) {
  if (grid.summary.length === 0) return <div className="text-sm text-muted">ไม่มีรายวิชา</div>;
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-xs print:text-[7pt] [&_td]:border [&_td]:border-line [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:border [&_th]:border-line [&_th]:bg-page [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:font-semibold">
        <thead>
          <tr>
            <th scope="col">รหัสวิชา</th>
            <th scope="col" className="text-left">
              ชื่อรายวิชา
            </th>
            <th scope="col" title="ทฤษฎี">
              ท.
            </th>
            <th scope="col" title="ปฏิบัติ">
              ป.
            </th>
            <th scope="col" title="หน่วยกิต">
              น.
            </th>
            <th scope="col" title="ชั่วโมงต่อสัปดาห์">
              ช.
            </th>
          </tr>
        </thead>
        <tbody>
          {grid.summary.map((r) => (
            <tr key={r.code} className={r.isActivity ? "bg-activity" : undefined}>
              <td className="whitespace-nowrap text-center">{r.code}</td>
              <td title={r.detail}>
                {r.name}
                {r.detail && <span className="text-muted"> ({r.detail})</span>}
              </td>
              <td className="text-center tabular-nums">{num(r.theory)}</td>
              <td className="text-center tabular-nums">{num(r.practice)}</td>
              <td className="text-center tabular-nums">{num(r.credits)}</td>
              <td className="text-center tabular-nums">{r.hours}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td colSpan={2} className="text-right">
              รวม <span className="font-normal text-muted">(รวมใน: {regular}) (รวมนอก: {outside})</span>
            </td>
            <td className="text-center tabular-nums">{grid.totals.theory}</td>
            <td className="text-center tabular-nums">{grid.totals.practice}</td>
            <td className="text-center tabular-nums">{grid.totals.credits}</td>
            <td className="text-center tabular-nums">{grid.totals.hours}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** แถวลงนามท้ายตารางสอนครู (4 คนเรียงซ้ายไปขวา) */
export function SignatureRow({ school }: { school: SchoolInfo }) {
  if (!school.signatories.length) return null;
  return (
    <div className="mt-6 grid grid-cols-2 gap-6 text-center text-sm sm:grid-cols-4 print:mt-3 print:grid-cols-4 print:gap-2 print:text-[8pt]">
      {school.signatories.slice(0, 4).map((s, i) => (
        <div key={i} className="space-y-0.5">
          <div className="whitespace-nowrap">ลงชื่อ..................................</div>
          <div>({s.name})</div>
          <div className="text-muted print:text-ink">{s.title}</div>
        </div>
      ))}
    </div>
  );
}
