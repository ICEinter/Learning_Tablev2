/**
 * Domain types ที่ใช้ร่วมกันทุกชั้น (UI, engine, store, export, import)
 * ไฟล์นี้ต้องไม่ import อะไรจาก UI/Firebase
 */

export type ID = string;
export type Role = "admin" | "teacher" | "student";

/** ช่วงเวลาอ้างอิงด้วย วัน (0 = จันทร์ … 6 = อาทิตย์) และเลขคาบ (เริ่มที่ 1) */
export interface SlotRef {
  day: number;
  period: number;
}

export interface Signatory {
  name: string;
  title: string;
}

export interface SchoolInfo {
  id: ID;
  name: string;
  departmentCode?: string; // เช่น "901"
  departmentName?: string; // เช่น "เทคโนโลยีสารสนเทศและการสื่อสาร"
  /** ผู้ลงนามท้ายตารางสอน (เรียงซ้ายไปขวา) */
  signatories: Signatory[];
  /** เวลาสิ้นสุด "ในเวลาราชการ" ใช้แยก รวมใน / รวมนอก เช่น "16:30" */
  regularEndTime: string;
}

export interface AcademicTerm {
  id: ID;
  /** ปีการศึกษา พ.ศ. เช่น "2569" */
  year: string;
  /** ภาคเรียน เช่น "1" | "2" | "3" (ฤดูร้อน) */
  term: string;
  status: "setup" | "active" | "archived";
}

export interface DayDef {
  index: number; // 0..6
  label: string; // "วันจันทร์"
  short: string; // "จ."
  /** เปิดให้จัดคาบเรียนได้หรือไม่ (เสาร์/อาทิตย์แสดงแถวแต่ปิดไว้) */
  active: boolean;
}

export interface Period {
  no: number; // 1..N
  start: string; // "08:30"
  end: string; // "09:30"
  /** คาบพัก: ห้ามจัดคาบเรียน และคาบต่อเนื่องห้ามคร่อม */
  isBreak?: boolean;
  label?: string;
}

export interface TimeStructure {
  days: DayDef[];
  periods: Period[];
  /** กิจกรรมก่อนคาบแรก เช่น กิจกรรมหน้าเสาธง (แสดงเป็นคอลัมน์แนวตั้ง ไม่ใช่คาบ) */
  preActivity?: { label: string; start: string; end: string };
}

export type RoomType =
  | "lecture"
  | "computer"
  | "lab"
  | "workshop"
  | "language"
  | "activity"
  | "external";

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  lecture: "ห้องบรรยาย",
  computer: "ห้องปฏิบัติการคอมพิวเตอร์",
  lab: "ห้องปฏิบัติการวิทยาศาสตร์",
  workshop: "โรงฝึกงาน",
  language: "ห้องปฏิบัติการภาษา",
  activity: "พื้นที่กิจกรรม",
  external: "สถานประกอบการ/ภายนอก",
};

export interface Course {
  id: ID;
  code: string; // "31901-2008"
  name: string;
  theory: number; // ท.
  practice: number; // ป.
  credits: number; // น.
  /** จำนวนคาบต่อสัปดาห์ (ปกติ = ท. + ป.) */
  periodsPerWeek: number;
  /** การแบ่งคาบต่อเนื่อง เช่น [1, 2, 2] ผลรวมต้องเท่ากับ periodsPerWeek */
  blockSizes: number[];
  roomType: RoomType;
  requiredEquipment: string[];
  department?: string;
  /** วิชากิจกรรม (แสดงแยกจากวิชาสอนในสรุปภาระ) */
  isActivity?: boolean;
}

export interface Teacher {
  id: ID;
  code: string;
  prefix: string; // "นาย" | "นาง" | "นางสาว"
  firstName: string;
  lastName: string;
  position: string; // ข้าราชการครู | ครูพิเศษ | พนักงานราชการ
  degree?: string; // วุฒิการศึกษา
  department?: string;
  specialDuty?: string; // หน้าที่พิเศษ
  qualifiedCourseIds: ID[];
  unavailable: SlotRef[];
  /** ช่วงเวลาที่ขอเลี่ยง (Soft) */
  preferredOff: SlotRef[];
  maxPerDay: number;
  maxPerWeek: number;
  email?: string;
}

export interface Room {
  id: ID;
  code: string; // "IT4"
  name: string;
  capacity: number;
  type: RoomType;
  equipment: string[];
  unavailable: SlotRef[];
}

export interface StudentGroup {
  id: ID;
  code: string; // "สIT.1/1"
  name: string;
  level: string; // "ปวช." | "ปวส."
  department?: string;
  size: number;
  advisorTeacherId?: ID;
  note?: string; // "จบ.ม.6,ต่างสาขา"
}

/** ข้อมูลนักเรียนขั้นต่ำ — ไม่เก็บเลขบัตร วันเกิด ที่อยู่ เบอร์โทร */
export interface Student {
  id: ID;
  code: string;
  displayName: string;
  groupId: ID;
  /** รายการมอบหมายสอนที่ลงเพิ่มนอกกลุ่ม (เช่น เรียนซ้ำ/วิชาเลือกข้ามกลุ่ม) */
  extraAssignmentIds: ID[];
}

export interface Assignment {
  id: ID;
  courseId: ID;
  teacherId: ID;
  /** กลุ่มเรียนที่เรียนร่วมกัน (ส่วนใหญ่ 1 กลุ่ม) */
  groupIds: ID[];
  /** ถ้าไม่ระบุใช้ค่าจากรายวิชา */
  periodsPerWeek?: number;
  blockSizes?: number[];
  /** บังคับห้อง (เช่น สถานประกอบการ) */
  fixedRoomId?: ID;
}

/** กิจกรรมที่ล็อกเวลา เช่น Home Room, PLC, ชุมนุม */
export interface LockedActivity {
  id: ID;
  code: string; // "Home Room" | "PLC"
  name: string;
  day: number;
  startPeriod: number;
  length: number;
  /** true = ทุกกลุ่มและทุกครู */
  appliesToAll: boolean;
  teacherIds: ID[];
  groupIds: ID[];
  roomId?: ID;
  /** นับเป็นชั่วโมงในสรุปภาระ (แสดงแยกจากคาบสอน) */
  countsAsLoad: boolean;
}

/** เกณฑ์ภาระชั่วโมงสอนตามระเบียบสถานศึกษา */
export interface WorkloadRule {
  id: ID;
  name: string; // เช่น "ครูปกติ สอน ปวช."
  role: "teacher" | "head"; // บทบาท (ครูปกติ หรือ หน.งาน/หน.แผนก)
  level: "ปวช." | "ปวส."; // ระดับการศึกษา
  standardHours: number; // เช่น 18, 15, 12, 10
  note?: string;
}

export interface Dataset {
  school: SchoolInfo;
  term: AcademicTerm;
  time: TimeStructure;
  courses: Course[];
  teachers: Teacher[];
  rooms: Room[];
  groups: StudentGroup[];
  students: Student[];
  assignments: Assignment[];
  activities: LockedActivity[];
  workloadRules?: WorkloadRule[];
}

export type EntityKind =
  | "courses"
  | "teachers"
  | "rooms"
  | "groups"
  | "students"
  | "assignments"
  | "activities";

export type EntityOf<K extends EntityKind> = Dataset[K][number];

/** การวางคาบ 1 block (คาบต่อเนื่อง) ของรายการมอบหมายสอน */
export interface Placement {
  assignmentId: ID;
  /** ลำดับ block ใน blockSizes ของรายการนั้น */
  block: number;
  day: number;
  /** คาบเริ่มต้น block */
  period: number;
  roomId: ID;
}

export type TimetableStatus = "draft" | "published" | "archived";

export interface TimetableVersion {
  id: ID;
  termId: ID;
  label: string;
  status: TimetableStatus;
  placements: Placement[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  source: { algorithm: string; seed?: number; jobId?: string };
  metrics?: { hard: number; soft: number; elapsedMs?: number };
  note?: string;
}

export interface Session {
  uid: string;
  role: Role;
  displayName: string;
  teacherId?: ID;
  studentId?: ID;
  groupIds?: ID[];
}
