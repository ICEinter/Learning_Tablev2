"use client";
import { useMemo, useState } from "react";
import { useData } from "@/lib/store/data-context";
import type { Student } from "@/shared/types";
import { EntityList, FilterSelect, type ListColumn } from "./entity-list";
import { useLookups, type Lookups } from "./lookups";
import { StudentForm } from "./student-form";

function makeColumns(lk: Lookups): ListColumn<Student>[] {
  return [
    { header: "รหัส", cell: (s) => <span className="font-medium">{s.code}</span> },
    { header: "ชื่อที่แสดง", cell: (s) => s.displayName },
    { header: "กลุ่มเรียน", cell: (s) => lk.groupById.get(s.groupId)?.code ?? <span className="text-danger">ไม่พบ</span> },
    {
      header: "ลงเพิ่ม",
      cell: (s) =>
        s.extraAssignmentIds.length ? (
          <span className="text-xs">{s.extraAssignmentIds.map((id) => lk.courseById.get(lk.assignmentById.get(id)?.courseId ?? "")?.code ?? id).join(", ")}</span>
        ) : (
          "-"
        ),
    },
  ];
}

export function StudentsTab() {
  const { dataset } = useData();
  const lk = useLookups();
  const [group, setGroup] = useState("");
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const columns = useMemo(() => makeColumns(lk), [lk]);
  const items = useMemo(() => dataset.students.filter((s) => !group || s.groupId === group), [dataset.students, group]);

  return (
    <>
      <EntityList
        kind="students"
        items={items}
        totalCount={dataset.students.length}
        columns={columns}
        searchText={(s) => `${s.code} ${s.displayName}`}
        searchPlaceholder="รหัสหรือชื่อ"
        filters={<FilterSelect label="กลุ่มเรียน" value={group} onChange={setGroup} allLabel="ทุกกลุ่ม" options={dataset.groups.map((g) => ({ value: g.id, label: g.code }))} />}
        cardTitle={(s) => `${s.code} · ${s.displayName}`}
        cardMeta={(s) => `กลุ่ม ${lk.groupById.get(s.groupId)?.code ?? "ไม่พบ"}${s.extraAssignmentIds.length ? ` · ลงเพิ่ม ${s.extraAssignmentIds.length} รายการ` : ""}`}
        rowLabel={(s) => `${s.code} ${s.displayName}`}
        onAdd={() => setEditing("new")}
        onEdit={setEditing}
      />
      {editing && <StudentForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
