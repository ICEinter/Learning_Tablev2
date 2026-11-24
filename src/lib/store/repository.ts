/**
 * Repository — ชั้นจัดเก็บข้อมูลที่สลับได้ระหว่าง
 *  - LocalRepository: โหมดสาธิต (localStorage ในเบราว์เซอร์) ใช้เมื่อยังไม่ตั้งค่า Firebase
 *  - FirestoreRepository: Cloud Firestore (ดู firestore-repository.ts)
 */
import type { Dataset, EntityKind, EntityOf, ID, TimetableVersion } from "@/shared/types";

export type SettingsPatch = Partial<Pick<Dataset, "school" | "term" | "time">>;

export interface Snapshot {
  dataset: Dataset;
  timetables: TimetableVersion[];
}

export interface Repository {
  readonly mode: "local" | "firebase";
  load(): Promise<Snapshot>;
  upsert<K extends EntityKind>(kind: K, items: EntityOf<K>[]): Promise<void>;
  remove(kind: EntityKind, ids: ID[]): Promise<void>;
  saveSettings(patch: SettingsPatch): Promise<void>;
  /** แทนที่ทั้งชุดข้อมูล (ใช้กับ "รีเซ็ตเป็นข้อมูลจำลอง") */
  replaceAll(dataset: Dataset, timetables?: TimetableVersion[]): Promise<void>;
  saveTimetable(tt: TimetableVersion): Promise<void>;
  deleteTimetable(id: ID): Promise<void>;
  /** ตั้งฉบับที่เลือกเป็น published และเก็บฉบับเดิมเป็น archived */
  publishTimetable(id: ID): Promise<void>;
}
