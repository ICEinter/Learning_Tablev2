"use client";
/**
 * /admin/timetables/[id] — ดูตารางทุกมุมมอง + โหมดแก้ไข (เฉพาะร่าง) + ข้อขัดแย้ง + ส่งออก
 * สถานะมุมมอง/entity เก็บใน query string (?view=teacher&id=t05)
 */
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { validate } from "@/engine";
import type { Violation } from "@/engine/types";
import { useData } from "@/lib/store/data-context";
import { gridFileBase } from "@/lib/timetable/overview";
import { buildGrid, entityOptions, VIEW_LABEL, type ViewKind } from "@/lib/timetable/viewmodel";
import type { Placement } from "@/shared/types";
import { Badge, Button, Card, EmptyState, PageHeader, Tabs, useToast } from "@/components/ui";
import { ConfirmDialog } from "@/components/timetable/confirm-dialog";
import { EntityPicker } from "@/components/timetable/entity-picker";
import { TimetableExportBar } from "@/components/timetable/export-bar";
import { GridSummary } from "@/components/timetable/grid-summary";
import { OverviewView } from "@/components/timetable/overview-view";
import { TimetableGridView } from "@/components/timetable/timetable-grid";
import { useTimetableEditor } from "@/components/timetable/use-timetable-editor";
import {
  conflictSlotsFor,
  duplicateAsDraft,
  focusTarget,
  formatDateTime,
  STATUS_TEXT,
  STATUS_TONE,
} from "@/components/timetable/utils";
import { ViolationsPanel } from "@/components/timetable/violations-panel";
import { EditPanel } from "./edit-panel";

type View = ViewKind | "overview";
const VIEWS: View[] = ["teacher", "room", "group", "student", "course", "overview"];
const EMPTY: Placement[] = [];

export function TimetableDetail() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { dataset: ds, timetables, saveTimetable, publishTimetable } = useData();
  const tt = timetables.find((t) => t.id === params.id);

  const viewParam = sp.get("view") as View | null;
  const view: View = viewParam && VIEWS.includes(viewParam) ? viewParam : "teacher";
  const options = useMemo(() => (view === "overview" ? [] : entityOptions(ds, view)), [ds, view]);
  const idParam = sp.get("id");
  const entityId = idParam && options.some((o) => o.id === idParam) ? idParam : (options[0]?.id ?? "");

  const setQuery = useCallback(
    (v: View, id?: string) => {
      const q = new URLSearchParams({ view: v });
      if (id) q.set("id", id);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const editor = useTimetableEditor(tt?.placements ?? EMPTY);
  const [editing, setEditing] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const placements = editor.placements;
  const canEdit = tt?.status === "draft";

  const validation = useMemo(() => validate(ds, placements), [ds, placements]);
  const baseScore = useMemo(
    () => (editor.dirty && tt ? validate(ds, tt.placements).score : validation.score),
    [editor.dirty, tt, ds, validation.score],
  );

  const grid = useMemo(() => {
    if (view === "overview" || !entityId) return null;
    return buildGrid(ds, placements, view, entityId, {
      conflictSlots: conflictSlotsFor(ds, placements, validation.violations, view, entityId),
    });
  }, [ds, placements, view, entityId, validation.violations]);

  const dayLabel = useCallback((d: number) => ds.time.days.find((x) => x.index === d)?.label ?? String(d), [ds]);

  if (!tt) {
    return (
      <EmptyState title="ไม่พบตารางนี้">
        <Link href="/admin/timetables" className="text-accent underline">
          กลับไปหน้ารายการตาราง
        </Link>
      </EmptyState>
    );
  }

  const onFocus = (v: Violation) => {
    const t = focusTarget(ds, v);
    if (!t) return;
    setQuery(t.kind, t.id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicate = async () => {
    const copy = duplicateAsDraft(tt, `${tt.label} (ร่างแก้ไข)`);
    await saveTimetable(copy);
    toast("สร้างสำเนาเป็นร่างแล้ว", "ok");
    router.push(`/admin/timetables/${copy.id}?${sp.toString()}`);
  };

  const hard = validation.score.hard;
  const soft = validation.score.soft;

  return (
    <div className="space-y-4">
      <PageHeader
        title={tt.label}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[tt.status]}>{STATUS_TEXT[tt.status]}</Badge>
            <Badge tone={hard ? "danger" : "ok"}>Hard {hard}</Badge>
            <Badge tone="warn">Soft {Math.round(soft * 10) / 10}</Badge>
            <span>
              สร้าง {formatDateTime(tt.createdAt)} · แก้ไขล่าสุด {formatDateTime(tt.updatedAt)} · {tt.source.algorithm}
              {tt.source.seed !== undefined ? ` (seed ${tt.source.seed})` : ""}
            </span>
          </span>
        }
        actions={
          <>
            <Link href="/admin/timetables" className="text-sm text-accent underline">
              ← รายการตาราง
            </Link>
            {canEdit ? (
              <>
                <Button
                  variant={editing ? "primary" : "secondary"}
                  aria-pressed={editing}
                  onClick={() => setEditing((v) => !v)}
                  disabled={view === "overview"}
                  title={view === "overview" ? "เลือกมุมมองครู/ห้อง/กลุ่มเพื่อแก้ไข" : undefined}
                >
                  {editing ? "ปิดโหมดแก้ไข" : "แก้ไขตาราง"}
                </Button>
                <Button onClick={() => setConfirmPublish(true)} disabled={editor.dirty}>
                  เผยแพร่
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={duplicate}>
                ทำสำเนาเป็นร่างเพื่อแก้ไข
              </Button>
            )}
          </>
        }
      />

      {!canEdit && (
        <p className="no-print text-sm text-muted">ตาราง{STATUS_TEXT[tt.status]}เป็นแบบอ่านอย่างเดียว — ทำสำเนาเป็นร่างเพื่อแก้ไข</p>
      )}

      <Tabs<View>
        value={view}
        onChange={(v) => setQuery(v)}
        items={VIEWS.map((v) => ({ value: v, label: v === "overview" ? "ตารางรวม" : VIEW_LABEL[v] }))}
      />

      {canEdit && editor.dirty && !editing && (
        <div className="no-print flex flex-wrap items-center gap-2 rounded-md border border-warn/30 bg-warn-soft px-4 py-2 text-sm">
          <span>มีการแก้ไข {editor.changes} รายการที่ยังไม่บันทึก</span>
          <Button size="sm" onClick={() => setEditing(true)}>
            กลับไปแก้ไข/บันทึก
          </Button>
          <Button size="sm" variant="danger" onClick={editor.reset}>
            ยกเลิกการแก้ไข
          </Button>
        </div>
      )}

      {view === "overview" ? (
        <Card>
          <OverviewView ds={ds} placements={placements} versionLabel={tt.label} />
        </Card>
      ) : (
        <Card>
          <div className="no-print mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <EntityPicker label={`เลือก${VIEW_LABEL[view]}`} options={options} value={entityId} onChange={(id) => setQuery(view, id)} />
            <TimetableExportBar
              school={ds.school}
              fileBase={gridFileBase(ds, view, entityId)}
              allFileBase={gridFileBase(ds, view, null)}
              allLabel={`${VIEW_LABEL[view]}ทั้งหมด`}
              current={() => grid}
              all={() => entityOptions(ds, view).map((o) => buildGrid(ds, placements, view, o.id))}
            />
          </div>
          {grid ? (
            editing && canEdit ? (
              <EditPanel
                ds={ds}
                tt={tt}
                editor={editor}
                validation={validation}
                baseScore={baseScore}
                grid={grid}
                saveTimetable={saveTimetable}
                onExit={() => setEditing(false)}
              />
            ) : (
              <>
                <GridSummary stats={grid.stats} className="no-print mb-3" />
                <TimetableGridView grid={grid} school={ds.school} violations={validation.violations} />
              </>
            )
          ) : (
            <EmptyState title={`ยังไม่มีข้อมูล${VIEW_LABEL[view]}`} />
          )}
        </Card>
      )}

      <Card title="ข้อขัดแย้ง" className="no-print">
        <ViolationsPanel violations={validation.violations} dayLabel={dayLabel} onFocus={onFocus} />
      </Card>

      <ConfirmDialog
        open={confirmPublish}
        title="ยืนยันการเผยแพร่"
        confirmLabel="เผยแพร่"
        onClose={() => setConfirmPublish(false)}
        onConfirm={async () => {
          const r = await publishTimetable(tt.id);
          toast(r.message, r.ok ? "ok" : "danger");
          setConfirmPublish(false);
        }}
      >
        เผยแพร่ &quot;{tt.label}&quot; ให้ครูและนักเรียนเห็น? ฉบับที่เผยแพร่อยู่เดิมจะถูกเก็บถาวร
        {hard > 0 && <p className="mt-2 text-danger">ตารางนี้ยังมีข้อขัดแย้ง Hard {hard} รายการ — ระบบจะไม่อนุญาตให้เผยแพร่</p>}
      </ConfirmDialog>
    </div>
  );
}
