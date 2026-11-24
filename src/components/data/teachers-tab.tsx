"use client";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { useData } from "@/lib/store/data-context";
import { teacherName } from "@/shared/slots";
import type { Teacher } from "@/shared/types";
import { EntityList, FilterSelect, type ListColumn } from "./entity-list";
import { useLookups, type Lookups } from "./lookups";
import { TeacherForm } from "./teacher-form";

function LoadBadge({ load, max }: { load: number; max: number }) {
  const tone = load > max ? "danger" : load === 0 ? "neutral" : load >= max * 0.9 ? "warn" : "ok";
  return (
    <Badge tone={tone}>
      <span className="tabular-nums">
        {load}/{max}
      </span>
      {load > max ? " เกิน" : ""}
    </Badge>
  );
}

function makeColumns(lk: Lookups): ListColumn<Teacher>[] {
  return [
    { header: "รหัส", cell: (t) => <span className="font-medium">{t.code}</span> },
    { header: "ชื่อ-สกุล", cell: (t) => <span className="whitespace-nowrap">{teacherName(t)}</span> },
    { header: "ตำแหน่ง", cell: (t) => t.position },
    { header: "แผนก", cell: (t) => t.department ?? "-" },
    { header: "วิชาที่สอนได้", cell: (t) => (t.qualifiedCourseIds.length ? `${t.qualifiedCourseIds.length} วิชา` : "ทุกวิชา") },
    { header: "ภาระ/สูงสุด", cell: (t) => <LoadBadge load={lk.teacherLoad.get(t.id) ?? 0} max={t.maxPerWeek} /> },
    { header: "ไม่ว่าง", cell: (t) => <span className="tabular-nums">{t.unavailable.length} ช่อง</span> },
  ];
}

export function TeachersTab() {
  const { dataset } = useData();
  const lk = useLookups();
  const [dept, setDept] = useState("");
  const [position, setPosition] = useState("");
  const [editing, setEditing] = useState<Teacher | "new" | null>(null);
  const columns = useMemo(() => makeColumns(lk), [lk]);
  const positions = useMemo(() => [...new Set(dataset.teachers.map((t) => t.position))].sort(), [dataset.teachers]);

  const items = useMemo(
    () => dataset.teachers.filter((t) => (!dept || t.department === dept) && (!position || t.position === position)),
    [dataset.teachers, dept, position],
  );

  return (
    <>
      <EntityList
        kind="teachers"
        items={items}
        totalCount={dataset.teachers.length}
        columns={columns}
        searchText={(t) => `${t.code} ${teacherName(t)} ${t.email ?? ""}`}
        searchPlaceholder="รหัส ชื่อ หรืออีเมล"
        filters={
          <>
            <FilterSelect label="แผนก" value={dept} onChange={setDept} allLabel="ทุกแผนก" options={lk.departments.map((d) => ({ value: d, label: d }))} />
            <FilterSelect label="ตำแหน่ง" value={position} onChange={setPosition} allLabel="ทุกตำแหน่ง" options={positions.map((p) => ({ value: p, label: p }))} />
          </>
        }
        cardTitle={(t) => `${t.code} · ${teacherName(t)}`}
        cardMeta={(t) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            {t.position}
            {t.department ? ` · ${t.department}` : ""} <LoadBadge load={lk.teacherLoad.get(t.id) ?? 0} max={t.maxPerWeek} />
          </span>
        )}
        rowLabel={(t) => teacherName(t)}
        onAdd={() => setEditing("new")}
        onEdit={setEditing}
      />
      {editing && <TeacherForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
