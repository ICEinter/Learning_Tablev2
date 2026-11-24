"use client";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { useData } from "@/lib/store/data-context";
import { ROOM_TYPE_LABEL, type Course, type RoomType } from "@/shared/types";
import { CourseForm } from "./course-form";
import { EntityList, FilterSelect, type ListColumn } from "./entity-list";
import { useLookups } from "./lookups";

const columns: ListColumn<Course>[] = [
  { header: "รหัสวิชา", cell: (c) => <span className="font-medium whitespace-nowrap">{c.code}</span> },
  {
    header: "ชื่อวิชา",
    cell: (c) => (
      <>
        {c.name} {c.isActivity && <Badge>กิจกรรม</Badge>}
      </>
    ),
  },
  { header: "ท-ป-น", cell: (c) => <span className="tabular-nums whitespace-nowrap">{`${c.theory}-${c.practice}-${c.credits}`}</span> },
  { header: "คาบ/สัปดาห์", cell: (c) => <span className="tabular-nums">{`${c.periodsPerWeek} (${c.blockSizes.join("+")})`}</span> },
  { header: "ประเภทห้อง", cell: (c) => ROOM_TYPE_LABEL[c.roomType] },
  { header: "แผนก", cell: (c) => c.department ?? "-" },
];

export function CoursesTab() {
  const { dataset } = useData();
  const lk = useLookups();
  const [dept, setDept] = useState("");
  const [roomType, setRoomType] = useState("");
  const [editing, setEditing] = useState<Course | "new" | null>(null);

  const items = useMemo(
    () => dataset.courses.filter((c) => (!dept || c.department === dept) && (!roomType || c.roomType === roomType)),
    [dataset.courses, dept, roomType],
  );

  return (
    <>
      <EntityList
        kind="courses"
        items={items}
        totalCount={dataset.courses.length}
        columns={columns}
        searchText={(c) => `${c.code} ${c.name}`}
        searchPlaceholder="รหัสหรือชื่อวิชา"
        filters={
          <>
            <FilterSelect label="แผนก" value={dept} onChange={setDept} allLabel="ทุกแผนก" options={lk.departments.map((d) => ({ value: d, label: d }))} />
            <FilterSelect
              label="ประเภทห้อง"
              value={roomType}
              onChange={setRoomType}
              allLabel="ทุกประเภท"
              options={(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => ({ value: t, label: ROOM_TYPE_LABEL[t] }))}
            />
          </>
        }
        cardTitle={(c) => `${c.code} ${c.name}`}
        cardMeta={(c) => `ท-ป-น ${c.theory}-${c.practice}-${c.credits} · ${c.periodsPerWeek} คาบ (${c.blockSizes.join("+")}) · ${ROOM_TYPE_LABEL[c.roomType]}`}
        rowLabel={(c) => `${c.code} ${c.name}`}
        onAdd={() => setEditing("new")}
        onEdit={setEditing}
      />
      {editing && <CourseForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
