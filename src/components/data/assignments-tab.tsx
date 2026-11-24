"use client";
import { useMemo, useState } from "react";
import { useData } from "@/lib/store/data-context";
import { effectiveBlocks, teacherName } from "@/shared/slots";
import type { Assignment } from "@/shared/types";
import { AssignmentForm } from "./assignment-form";
import { EntityList, FilterSelect, type ListColumn } from "./entity-list";
import { useLookups, type Lookups } from "./lookups";

function makeColumns(lk: Lookups): ListColumn<Assignment>[] {
  return [
    {
      header: "รายวิชา",
      cell: (a) => {
        const c = lk.courseById.get(a.courseId);
        return c ? (
          <>
            <span className="font-medium">{c.code}</span> <span className="text-muted">{c.name}</span>
          </>
        ) : (
          <span className="text-danger">ไม่พบ {a.courseId}</span>
        );
      },
    },
    {
      header: "ครู",
      cell: (a) => {
        const t = lk.teacherById.get(a.teacherId);
        return t ? <span className="whitespace-nowrap">{teacherName(t)}</span> : <span className="text-danger">ไม่พบ</span>;
      },
    },
    { header: "กลุ่มเรียน", cell: (a) => a.groupIds.map((g) => lk.groupById.get(g)?.code ?? g).join(", ") },
    { header: "ผู้เรียน", cell: (a) => <span className="tabular-nums">{lk.groupSize(a.groupIds)}</span> },
    {
      header: "คาบ",
      cell: (a) => {
        const b = effectiveBlocks(a, lk.courseById.get(a.courseId));
        return <span className="tabular-nums whitespace-nowrap">{`${b.reduce((s, n) => s + n, 0)} (${b.join("+")})`}</span>;
      },
    },
    { header: "บังคับห้อง", cell: (a) => (a.fixedRoomId ? (lk.roomById.get(a.fixedRoomId)?.code ?? a.fixedRoomId) : "-") },
  ];
}

export function AssignmentsTab() {
  const { dataset } = useData();
  const lk = useLookups();
  const [teacher, setTeacher] = useState("");
  const [group, setGroup] = useState("");
  const [editing, setEditing] = useState<Assignment | "new" | null>(null);
  const columns = useMemo(() => makeColumns(lk), [lk]);
  const items = useMemo(
    () => dataset.assignments.filter((a) => (!teacher || a.teacherId === teacher) && (!group || a.groupIds.includes(group))),
    [dataset.assignments, teacher, group],
  );

  return (
    <>
      <EntityList
        kind="assignments"
        items={items}
        totalCount={dataset.assignments.length}
        columns={columns}
        searchText={(a) => `${lk.assignmentLabel(a)} ${lk.courseById.get(a.courseId)?.name ?? ""}`}
        searchPlaceholder="รหัสวิชา ชื่อวิชา กลุ่ม หรือครู"
        filters={
          <>
            <FilterSelect label="ครู" value={teacher} onChange={setTeacher} allLabel="ครูทุกคน" options={dataset.teachers.map((t) => ({ value: t.id, label: teacherName(t) }))} />
            <FilterSelect label="กลุ่มเรียน" value={group} onChange={setGroup} allLabel="ทุกกลุ่ม" options={dataset.groups.map((g) => ({ value: g.id, label: g.code }))} />
          </>
        }
        cardTitle={(a) => {
          const c = lk.courseById.get(a.courseId);
          return c ? `${c.code} ${c.name}` : a.courseId;
        }}
        cardMeta={(a) => {
          const t = lk.teacherById.get(a.teacherId);
          const b = effectiveBlocks(a, lk.courseById.get(a.courseId));
          return `${t ? teacherName(t) : "ไม่พบครู"} · ${a.groupIds.map((g) => lk.groupById.get(g)?.code ?? g).join(", ")} · ${b.reduce((s, n) => s + n, 0)} คาบ`;
        }}
        rowLabel={(a) => lk.assignmentLabel(a)}
        onAdd={() => setEditing("new")}
        onEdit={setEditing}
      />
      {editing && <AssignmentForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
