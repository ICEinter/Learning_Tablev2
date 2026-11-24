"use client";
import { useMemo, useState } from "react";
import { useData } from "@/lib/store/data-context";
import { teacherName } from "@/shared/slots";
import type { StudentGroup } from "@/shared/types";
import { EntityList, FilterSelect, type ListColumn } from "./entity-list";
import { GroupForm } from "./group-form";
import { useLookups, type Lookups } from "./lookups";

function makeColumns(lk: Lookups): ListColumn<StudentGroup>[] {
  const advisor = (g: StudentGroup) => {
    const t = g.advisorTeacherId ? lk.teacherById.get(g.advisorTeacherId) : undefined;
    return t ? teacherName(t) : "-";
  };
  return [
    { header: "รหัส", cell: (g) => <span className="font-medium whitespace-nowrap">{g.code}</span> },
    { header: "ชื่อกลุ่ม", cell: (g) => g.name },
    { header: "ระดับ", cell: (g) => g.level },
    { header: "ผู้เรียน", cell: (g) => <span className="tabular-nums">{g.size}</span> },
    { header: "ครูที่ปรึกษา", cell: advisor },
    { header: "คาบ/สัปดาห์", cell: (g) => <span className="tabular-nums">{lk.groupPeriods.get(g.id) ?? 0}</span> },
    { header: "หมายเหตุ", cell: (g) => g.note ?? "" },
  ];
}

export function GroupsTab() {
  const { dataset } = useData();
  const lk = useLookups();
  const [level, setLevel] = useState("");
  const [dept, setDept] = useState("");
  const [editing, setEditing] = useState<StudentGroup | "new" | null>(null);
  const columns = useMemo(() => makeColumns(lk), [lk]);
  const levels = useMemo(() => [...new Set(dataset.groups.map((g) => g.level))].sort(), [dataset.groups]);
  const items = useMemo(
    () => dataset.groups.filter((g) => (!level || g.level === level) && (!dept || g.department === dept)),
    [dataset.groups, level, dept],
  );

  return (
    <>
      <EntityList
        kind="groups"
        items={items}
        totalCount={dataset.groups.length}
        columns={columns}
        searchText={(g) => `${g.code} ${g.name} ${g.note ?? ""}`}
        searchPlaceholder="รหัสหรือชื่อกลุ่ม"
        filters={
          <>
            <FilterSelect label="ระดับชั้น" value={level} onChange={setLevel} allLabel="ทุกระดับ" options={levels.map((x) => ({ value: x, label: x }))} />
            <FilterSelect label="แผนก" value={dept} onChange={setDept} allLabel="ทุกแผนก" options={lk.departments.map((d) => ({ value: d, label: d }))} />
          </>
        }
        cardTitle={(g) => `${g.code} · ${g.name}`}
        cardMeta={(g) => `${g.level} · ${g.size} คน · ${lk.groupPeriods.get(g.id) ?? 0} คาบ/สัปดาห์`}
        rowLabel={(g) => g.code}
        onAdd={() => setEditing("new")}
        onEdit={setEditing}
      />
      {editing && <GroupForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
