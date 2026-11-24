"use client";
import { useMemo, useState } from "react";
import { useData } from "@/lib/store/data-context";
import { ROOM_TYPE_LABEL, type Room, type RoomType } from "@/shared/types";
import { EntityList, FilterSelect, type ListColumn } from "./entity-list";
import { RoomForm } from "./room-form";

const columns: ListColumn<Room>[] = [
  { header: "รหัส", cell: (r) => <span className="font-medium">{r.code}</span> },
  { header: "ชื่อห้อง", cell: (r) => r.name },
  { header: "ประเภท", cell: (r) => ROOM_TYPE_LABEL[r.type] },
  { header: "ความจุ", cell: (r) => <span className="tabular-nums">{r.capacity}</span> },
  { header: "อุปกรณ์", cell: (r) => (r.equipment.length ? r.equipment.join(", ") : "-") },
  { header: "ใช้ไม่ได้", cell: (r) => <span className="tabular-nums">{r.unavailable.length} ช่อง</span> },
];

export function RoomsTab() {
  const { dataset } = useData();
  const [type, setType] = useState("");
  const [editing, setEditing] = useState<Room | "new" | null>(null);
  const items = useMemo(() => dataset.rooms.filter((r) => !type || r.type === type), [dataset.rooms, type]);

  return (
    <>
      <EntityList
        kind="rooms"
        items={items}
        totalCount={dataset.rooms.length}
        columns={columns}
        searchText={(r) => `${r.code} ${r.name} ${r.equipment.join(" ")}`}
        searchPlaceholder="รหัส ชื่อห้อง หรืออุปกรณ์"
        filters={
          <FilterSelect
            label="ประเภทห้อง"
            value={type}
            onChange={setType}
            allLabel="ทุกประเภท"
            options={(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => ({ value: t, label: ROOM_TYPE_LABEL[t] }))}
          />
        }
        cardTitle={(r) => `${r.code} · ${r.name}`}
        cardMeta={(r) => `${ROOM_TYPE_LABEL[r.type]} · ${r.capacity} คน${r.equipment.length ? ` · ${r.equipment.join(", ")}` : ""}`}
        rowLabel={(r) => `${r.code} ${r.name}`}
        onAdd={() => setEditing("new")}
        onEdit={setEditing}
      />
      {editing && <RoomForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
