import { createRayongDataset, createOfficialRayongTimetable } from "@/data/rayong";
import type { Dataset, EntityKind, EntityOf, ID, TimetableVersion } from "@/shared/types";
import type { Repository, SettingsPatch, Snapshot } from "./repository";

const KEY = "learning-table:v2";

interface Stored {
  version: 1;
  dataset: Dataset;
  timetables: TimetableVersion[];
}

function read(): Stored | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

/** โหมดสาธิต: เก็บข้อมูลใน localStorage ของเบราว์เซอร์ (ถ้าใช้ไม่ได้จะเก็บในหน่วยความจำ) */
export class LocalRepository implements Repository {
  readonly mode = "local" as const;
  private state: Stored;

  constructor() {
    const ds = createRayongDataset();
    const defaultTimetable = createOfficialRayongTimetable(ds);
    this.state = read() ?? { version: 1, dataset: ds, timetables: [defaultTimetable] };
  }

  /** ล้างข้อมูลเดิมทั้งหมดและบรรจุชุดข้อมูลจริงจากไฟล์แนบ */
  clearAllAndSeed(): void {
    const ds = createRayongDataset();
    const defaultTimetable = createOfficialRayongTimetable(ds);
    this.state = { version: 1, dataset: ds, timetables: [defaultTimetable] };
    this.persist();
  }

  private persist() {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* private mode / quota — ทำงานต่อในหน่วยความจำ */
    }
  }

  async load(): Promise<Snapshot> {
    return structuredClone({ dataset: this.state.dataset, timetables: this.state.timetables });
  }

  async upsert<K extends EntityKind>(kind: K, items: EntityOf<K>[]): Promise<void> {
    const list = this.state.dataset[kind] as unknown as { id: ID }[];
    const index = new Map(list.map((x, i) => [x.id, i]));
    for (const item of items as unknown as { id: ID }[]) {
      const i = index.get(item.id);
      if (i === undefined) list.push(structuredClone(item));
      else list[i] = structuredClone(item);
    }
    this.persist();
  }

  async remove(kind: EntityKind, ids: ID[]): Promise<void> {
    const set = new Set(ids);
    (this.state.dataset as unknown as Record<EntityKind, { id: ID }[]>)[kind] = (
      this.state.dataset[kind] as unknown as { id: ID }[]
    ).filter((x) => !set.has(x.id));
    this.persist();
  }

  async saveSettings(patch: SettingsPatch): Promise<void> {
    this.state.dataset = { ...this.state.dataset, ...structuredClone(patch) };
    this.persist();
  }

  async replaceAll(dataset: Dataset, timetables: TimetableVersion[] = []): Promise<void> {
    this.state = { version: 1, dataset: structuredClone(dataset), timetables: structuredClone(timetables) };
    this.persist();
  }

  async clearAll(): Promise<void> {
    this.state.dataset = {
      ...this.state.dataset,
      courses: [],
      teachers: [],
      rooms: [],
      groups: [],
      students: [],
      assignments: [],
      activities: [],
    };
    this.state.timetables = [];
    this.persist();
  }

  async saveTimetable(tt: TimetableVersion): Promise<void> {
    const i = this.state.timetables.findIndex((x) => x.id === tt.id);
    if (i >= 0) this.state.timetables[i] = structuredClone(tt);
    else this.state.timetables.unshift(structuredClone(tt));
    this.persist();
  }

  async deleteTimetable(id: ID): Promise<void> {
    this.state.timetables = this.state.timetables.filter((x) => x.id !== id);
    this.persist();
  }

  async publishTimetable(id: ID): Promise<void> {
    const now = new Date().toISOString();
    this.state.timetables = this.state.timetables.map((t) => {
      if (t.id === id) return { ...t, status: "published", publishedAt: now, updatedAt: now };
      if (t.status === "published") return { ...t, status: "archived", updatedAt: now };
      return t;
    });
    this.persist();
  }
}
