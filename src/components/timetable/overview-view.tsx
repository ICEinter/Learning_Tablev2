"use client";
/**
 * ตารางรวม — รายการคาบแบบกรองได้ + เมทริกซ์ (แถว = กลุ่มเรียน/ครู/ห้อง × คอลัมน์ = วัน,คาบ)
 * ตัวกรองมีผลกับไฟล์ส่งออกด้วย
 */
import { useMemo, useState } from "react";
import { buildMatrix, buildOverview, filterOverview, overviewReport, type MatrixAxis, type OverviewFilter } from "@/lib/timetable/overview";
import { teacherName, termLabel } from "@/shared/slots";
import type { Dataset, Placement } from "@/shared/types";
import { Input, Select, Tabs, cx } from "@/components/ui";
import { ReportExportBar } from "@/components/reports/report-export-bar";
import { ReportTableView, useReportView } from "@/components/reports/report-table";

type Mode = "list" | "matrix";

export function OverviewView({ ds, placements, versionLabel }: { ds: Dataset; placements: Placement[]; versionLabel: string }) {
  const [mode, setMode] = useState<Mode>("list");
  const [axis, setAxis] = useState<MatrixAxis>("group");
  const [f, setF] = useState<OverviewFilter>({ day: null, teacherId: null, groupId: null, roomId: null, courseId: null, text: "" });

  const entries = useMemo(() => buildOverview(ds, placements), [ds, placements]);
  const filtered = useMemo(() => filterOverview(entries, f), [entries, f]);

  const filterText = useMemo(() => {
    const parts: string[] = [];
    if (f.day != null) parts.push(ds.time.days.find((d) => d.index === f.day)?.label ?? "");
    if (f.teacherId) {
      const t = ds.teachers.find((x) => x.id === f.teacherId);
      if (t) parts.push(`ครู ${teacherName(t)}`);
    }
    if (f.groupId) parts.push(`กลุ่ม ${ds.groups.find((x) => x.id === f.groupId)?.code ?? ""}`);
    if (f.roomId) parts.push(`ห้อง ${ds.rooms.find((x) => x.id === f.roomId)?.code ?? ""}`);
    if (f.courseId) parts.push(`วิชา ${ds.courses.find((x) => x.id === f.courseId)?.code ?? ""}`);
    if (f.text?.trim()) parts.push(`ค้นหา "${f.text.trim()}"`);
    return parts.join(" · ");
  }, [f, ds]);

  const report = useMemo(
    () => overviewReport(filtered, [`ภาคเรียน ${termLabel(ds)} · ${versionLabel}`, filterText && `ตัวกรอง: ${filterText}`].filter(Boolean).join(" · ")),
    [filtered, ds, versionLabel, filterText],
  );
  const view = useReportView(report);
  const matrix = useMemo(() => (mode === "matrix" ? buildMatrix(ds, filtered, axis) : null), [mode, ds, filtered, axis]);

  const set = <K extends keyof OverviewFilter>(k: K, v: OverviewFilter[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="no-print grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Select aria-label="กรองวัน" value={f.day ?? ""} onChange={(e) => set("day", e.target.value === "" ? null : Number(e.target.value))}>
          <option value="">ทุกวัน</option>
          {ds.time.days.map((d) => (
            <option key={d.index} value={d.index}>
              {d.label}
            </option>
          ))}
        </Select>
        <Select aria-label="กรองครู" value={f.teacherId ?? ""} onChange={(e) => set("teacherId", e.target.value || null)}>
          <option value="">ครูทุกคน</option>
          {ds.teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {teacherName(t)}
            </option>
          ))}
        </Select>
        <Select aria-label="กรองกลุ่มเรียน" value={f.groupId ?? ""} onChange={(e) => set("groupId", e.target.value || null)}>
          <option value="">ทุกกลุ่มเรียน</option>
          {ds.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code}
            </option>
          ))}
        </Select>
        <Select aria-label="กรองห้อง" value={f.roomId ?? ""} onChange={(e) => set("roomId", e.target.value || null)}>
          <option value="">ทุกห้อง</option>
          {ds.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code}
            </option>
          ))}
        </Select>
        <Select aria-label="กรองรายวิชา" value={f.courseId ?? ""} onChange={(e) => set("courseId", e.target.value || null)}>
          <option value="">ทุกรายวิชา</option>
          {ds.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} {c.name}
            </option>
          ))}
        </Select>
        <Input aria-label="ค้นหาข้อความ" placeholder="ค้นหา…" value={f.text ?? ""} onChange={(e) => set("text", e.target.value)} />
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Tabs<Mode>
          value={mode}
          onChange={setMode}
          items={[
            { value: "list", label: `รายการ (${filtered.length})` },
            { value: "matrix", label: "เมทริกซ์" },
          ]}
        />
        <ReportExportBar
          school={ds.school}
          termLabel={termLabel(ds)}
          current={() => (view.table ? [view.table] : [])}
          fileBase={`ตารางรวม-${termLabel(ds)}`}
        />
      </div>

      {mode === "list" && <ReportTableView view={view} showFilter={false} />}

      {mode === "matrix" && matrix && (
        <div className="space-y-2">
          <div className="no-print flex items-center gap-2 text-sm">
            <span className="text-muted">แถว:</span>
            <Select aria-label="แกนแถวของเมทริกซ์" value={axis} onChange={(e) => setAxis(e.target.value as MatrixAxis)} className="w-40">
              <option value="group">กลุ่มเรียน</option>
              <option value="teacher">ครู</option>
              <option value="room">ห้อง</option>
            </Select>
          </div>
          <MatrixTable matrix={matrix} focusId={axis === "group" ? f.groupId : axis === "teacher" ? f.teacherId : f.roomId} dayFilter={f.day ?? null} />
        </div>
      )}
    </div>
  );
}

function MatrixTable({
  matrix,
  focusId,
  dayFilter,
}: {
  matrix: ReturnType<typeof buildMatrix>;
  focusId?: string | null;
  dayFilter: number | null;
}) {
  const rows = focusId ? matrix.rows.filter((r) => r.id === focusId) : matrix.rows;
  const days = dayFilter != null ? matrix.days.filter((d) => d.index === dayFilter) : matrix.days;
  return (
    <div className="print-area overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="border-collapse text-[11px] print:text-[5.5pt]">
        <thead>
          <tr className="bg-page">
            <th scope="col" rowSpan={2} className="sticky left-0 z-10 border border-line bg-page px-2 py-1 text-left">
              {matrix.axis === "group" ? "กลุ่มเรียน" : matrix.axis === "teacher" ? "ครู" : "ห้อง"}
            </th>
            {days.map((d) => (
              <th key={d.index} scope="colgroup" colSpan={matrix.periods.length} className="border border-line px-1 py-1">
                {d.label}
              </th>
            ))}
          </tr>
          <tr className="bg-page">
            {days.flatMap((d) =>
              matrix.periods.map((p) => (
                <th key={`${d.index}-${p}`} scope="col" className="min-w-[3.25rem] border border-line px-0.5 py-0.5 font-normal">
                  {p}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="sticky left-0 z-10 border border-line bg-surface px-2 py-1 text-left whitespace-nowrap">
                {r.label}
              </th>
              {days.flatMap((d) =>
                matrix.periods.map((p) => {
                  const c = matrix.cells.get(`${r.id}:${d.index}:${p}`);
                  return (
                    <td
                      key={`${d.index}-${p}`}
                      title={c ? `${d.label} คาบ ${p}: ${c.codes.join(", ")}` : undefined}
                      className={cx(
                        "border border-line px-0.5 py-0.5 text-center leading-tight",
                        c?.clash && "bg-danger-soft font-semibold text-danger",
                        c && !c.clash && c.activity && "bg-hatch",
                      )}
                    >
                      {c ? c.codes.map((x, i) => <div key={i} className="whitespace-nowrap">{x}</div>) : null}
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
