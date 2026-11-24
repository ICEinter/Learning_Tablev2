"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { Badge, PageHeader, Spinner, Tabs } from "@/components/ui";
import { ActivitiesTab } from "@/components/data/activities-tab";
import { AssignmentsTab } from "@/components/data/assignments-tab";
import { CoursesTab } from "@/components/data/courses-tab";
import { GroupsTab } from "@/components/data/groups-tab";
import { LookupsProvider, useLookups } from "@/components/data/lookups";
import { RoomsTab } from "@/components/data/rooms-tab";
import { StudentsTab } from "@/components/data/students-tab";
import { TeachersTab } from "@/components/data/teachers-tab";
import { useData } from "@/lib/store/data-context";
import type { EntityKind } from "@/shared/types";

const TABS: { value: EntityKind; label: string }[] = [
  { value: "courses", label: "รายวิชา" },
  { value: "teachers", label: "ครู" },
  { value: "rooms", label: "ห้องเรียน" },
  { value: "groups", label: "กลุ่มเรียน" },
  { value: "students", label: "นักเรียน" },
  { value: "assignments", label: "การมอบหมายสอน" },
  { value: "activities", label: "กิจกรรมล็อกเวลา" },
];

function isKind(v: string | null): v is EntityKind {
  return TABS.some((t) => t.value === v);
}

function TabContent({ tab }: { tab: EntityKind }) {
  switch (tab) {
    case "courses":
      return <CoursesTab />;
    case "teachers":
      return <TeachersTab />;
    case "rooms":
      return <RoomsTab />;
    case "groups":
      return <GroupsTab />;
    case "students":
      return <StudentsTab />;
    case "assignments":
      return <AssignmentsTab />;
    case "activities":
      return <ActivitiesTab />;
  }
}

function DataManager() {
  const { dataset, ready, error } = useData();
  const lk = useLookups();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: EntityKind = isKind(raw) ? raw : "courses";

  const errorCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of lk.issues) if (i.level === "error") m.set(i.entity, (m.get(i.entity) ?? 0) + 1);
    return m;
  }, [lk.issues]);

  const setTab = (v: EntityKind) => router.replace(`${pathname}?tab=${v}`, { scroll: false });

  return (
    <>
      <PageHeader
        title="จัดการข้อมูลหลัก"
        description="เพิ่ม แก้ไข ลบ และตรวจความถูกต้องของข้อมูลที่ใช้จัดตาราง"
        actions={
          <Link href="/admin/import" className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:border-accent hover:text-accent">
            นำเข้าจาก Excel/CSV
          </Link>
        }
      />
      {error && <p className="mb-3 text-sm text-danger">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      <Tabs
        value={tab}
        onChange={setTab}
        items={TABS.map((t) => ({
          value: t.value,
          label: (
            <span className="inline-flex items-center gap-1.5">
              {t.label}
              <span className="text-xs text-muted tabular-nums">{dataset[t.value].length}</span>
              {(errorCount.get(t.value) ?? 0) > 0 && (
                <Badge tone="danger" className="px-1.5">
                  <span className="sr-only">ข้อผิดพลาด</span>
                  {errorCount.get(t.value)}
                </Badge>
              )}
            </span>
          ),
        }))}
      />
      <div className="pt-4" role="tabpanel" aria-label={TABS.find((t) => t.value === tab)?.label}>
        {!ready ? (
          <div className="flex items-center gap-2 py-10 text-muted">
            <Spinner /> กำลังโหลดข้อมูล…
          </div>
        ) : (
          <TabContent key={tab} tab={tab} />
        )}
      </div>
    </>
  );
}

export default function DataPage() {
  return (
    <LookupsProvider>
      <Suspense fallback={<Spinner />}>
        <DataManager />
      </Suspense>
    </LookupsProvider>
  );
}
