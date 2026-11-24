"use client";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { useData } from "@/lib/store/data-context";
import type { LockedActivity, TimeStructure } from "@/shared/types";
import { ActivityForm } from "./activity-form";
import { EntityList, FilterSelect, type ListColumn } from "./entity-list";
import { useLookups, type Lookups } from "./lookups";

function when(time: TimeStructure, a: LockedActivity): string {
  const d = time.days.find((x) => x.index === a.day);
  const end = a.startPeriod + a.length - 1;
  return `${d?.short ?? a.day} คาบ ${a.startPeriod}${end > a.startPeriod ? `–${end}` : ""}`;
}

function who(lk: Lookups, a: LockedActivity): string {
  if (a.appliesToAll) return "ทุกคน";
  const parts: string[] = [];
  if (a.groupIds.length) parts.push(`${a.groupIds.length} กลุ่ม (${a.groupIds.slice(0, 3).map((g) => lk.groupById.get(g)?.code ?? g).join(", ")}${a.groupIds.length > 3 ? "…" : ""})`);
  if (a.teacherIds.length) parts.push(`ครู ${a.teacherIds.length} คน`);
  return parts.join(" · ") || "-";
}

export function ActivitiesTab() {
  const { dataset } = useData();
  const lk = useLookups();
  const [day, setDay] = useState("");
  const [editing, setEditing] = useState<LockedActivity | "new" | null>(null);
  const time = dataset.time;
  const columns = useMemo<ListColumn<LockedActivity>[]>(
    () => [
      { header: "รหัส", cell: (a) => <span className="font-medium whitespace-nowrap">{a.code}</span> },
      { header: "ชื่อกิจกรรม", cell: (a) => a.name },
      { header: "เวลา", cell: (a) => <span className="whitespace-nowrap">{when(time, a)}</span> },
      { header: "ผู้เข้าร่วม", cell: (a) => who(lk, a) },
      { header: "สถานที่", cell: (a) => (a.roomId ? (lk.roomById.get(a.roomId)?.code ?? a.roomId) : "-") },
      { header: "นับภาระ", cell: (a) => (a.countsAsLoad ? <Badge tone="accent">นับ</Badge> : <Badge>ไม่นับ</Badge>) },
    ],
    [lk, time],
  );
  const items = useMemo(() => dataset.activities.filter((a) => day === "" || a.day === Number(day)), [dataset.activities, day]);

  return (
    <>
      <EntityList
        kind="activities"
        items={items}
        totalCount={dataset.activities.length}
        columns={columns}
        searchText={(a) => `${a.code} ${a.name}`}
        searchPlaceholder="รหัสหรือชื่อกิจกรรม"
        filters={<FilterSelect label="วัน" value={day} onChange={setDay} allLabel="ทุกวัน" options={time.days.map((d) => ({ value: String(d.index), label: d.label }))} />}
        cardTitle={(a) => `${a.code} · ${a.name}`}
        cardMeta={(a) => `${when(time, a)} · ${who(lk, a)}`}
        rowLabel={(a) => `${a.code} (${when(time, a)})`}
        onAdd={() => setEditing("new")}
        onEdit={setEditing}
      />
      {editing && <ActivityForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
