/**
 * โหลดชุดข้อมูลจาก Firestore ด้วย Admin SDK (ฝั่ง server) — อ่านครั้งเดียวต่อคำขอ
 */
import type { Firestore } from "firebase-admin/firestore";
import { HttpError } from "@/lib/auth/server";
import {
  TERM_ENTITY_KINDS,
  fsPaths,
  withId,
  type SchoolDoc,
  type TermDoc,
} from "@/shared/codec";
import type { Dataset, TimeStructure } from "@/shared/types";

export interface ServerDataset {
  dataset: Dataset;
  termId: string;
  term: TermDoc;
}

export async function loadActiveTermId(db: Firestore, schoolId: string): Promise<string> {
  const school = await db.doc(fsPaths.school(schoolId)).get();
  const termId = (school.data() as SchoolDoc | undefined)?.activeTermId;
  if (!school.exists || !termId) {
    throw new HttpError(409, "ยังไม่มีข้อมูลสถานศึกษา/ภาคเรียนปัจจุบันในฐานข้อมูล กรุณาบันทึกการตั้งค่าก่อน");
  }
  return termId;
}

export async function loadServerDataset(db: Firestore, schoolId: string): Promise<ServerDataset> {
  const schoolSnap = await db.doc(fsPaths.school(schoolId)).get();
  const school = schoolSnap.data() as SchoolDoc | undefined;
  if (!school?.activeTermId) {
    throw new HttpError(409, "ยังไม่มีข้อมูลสถานศึกษา/ภาคเรียนปัจจุบันในฐานข้อมูล กรุณาบันทึกการตั้งค่าก่อน");
  }
  const termId = school.activeTermId;
  const [termSnap, timeSnap, studentsSnap, ...entitySnaps] = await Promise.all([
    db.doc(fsPaths.term(schoolId, termId)).get(),
    db.doc(fsPaths.time(schoolId, termId)).get(),
    db.collection(fsPaths.students(schoolId)).get(),
    ...TERM_ENTITY_KINDS.map((k) => db.collection(fsPaths.entity(schoolId, termId, k)).get()),
  ]);
  const term = termSnap.data() as TermDoc | undefined;
  const time = timeSnap.data() as TimeStructure | undefined;
  if (!term || !time) throw new HttpError(409, "ข้อมูลภาคเรียนหรือโครงสร้างเวลาไม่ครบ กรุณาบันทึกการตั้งค่าก่อน");

  const lists = Object.fromEntries(
    TERM_ENTITY_KINDS.map((k, i) => [k, entitySnaps[i].docs.map((d) => withId(d.id, d.data()))]),
  ) as Pick<Dataset, (typeof TERM_ENTITY_KINDS)[number]>;

  const dataset: Dataset = {
    school: {
      id: schoolId,
      name: school.name,
      departmentCode: (school as SchoolDoc & { departmentCode?: string }).departmentCode ?? "901",
      departmentName: (school as SchoolDoc & { departmentName?: string }).departmentName ?? "เทคโนโลยีสารสนเทศและการสื่อสาร",
      regularEndTime: school.regularEndTime,
      signatories: school.signatories ?? [],
    },
    term: { id: termId, year: term.year, term: term.term, status: term.status },
    time,
    ...lists,
    students: studentsSnap.docs.map((d) => withId(d.id, d.data())),
  };
  return { dataset, termId, term };
}
