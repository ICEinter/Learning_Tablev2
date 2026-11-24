/**
 * ข้อมูลจำลอง (สังเคราะห์) สำหรับสาธิต — โครงสร้างอ้างอิงจากตัวอย่างตารางสอนของวิทยาลัยเทคนิค
 * ชื่อบุคคลทั้งหมดเป็นชื่อสมมติ ไม่ใช่ข้อมูลจริง
 * รหัส/ชื่อรายวิชาใช้รูปแบบหลักสูตร ปวช./ปวส. เพื่อความสมจริง
 */
import type {
  Assignment,
  Course,
  Dataset,
  DayDef,
  LockedActivity,
  Period,
  Room,
  Student,
  StudentGroup,
  Teacher,
} from "@/shared/types";

export const THAI_DAYS: DayDef[] = [
  { index: 0, label: "วันจันทร์", short: "จ.", active: true },
  { index: 1, label: "วันอังคาร", short: "อ.", active: true },
  { index: 2, label: "วันพุธ", short: "พ.", active: true },
  { index: 3, label: "วันพฤหัสบดี", short: "พฤ.", active: true },
  { index: 4, label: "วันศุกร์", short: "ศ.", active: true },
  { index: 5, label: "วันเสาร์", short: "ส.", active: false },
  { index: 6, label: "วันอาทิตย์", short: "อา.", active: false },
];

function hourlyPeriods(): Period[] {
  // คาบ 1–13: 08:30–21:30 คาบละ 1 ชั่วโมง
  return Array.from({ length: 13 }, (_, i) => {
    const sh = 8 + i;
    const pad = (n: number) => String(n).padStart(2, "0");
    return { no: i + 1, start: `${pad(sh)}:30`, end: `${pad(sh + 1)}:30` };
  });
}

const COMP = ["คอมพิวเตอร์", "โปรเจกเตอร์"];

const rooms: Room[] = [
  { id: "r-it1", code: "IT1", name: "ห้องปฏิบัติการคอมพิวเตอร์ IT1", capacity: 40, type: "computer", equipment: [...COMP, "อุปกรณ์เครือข่าย"], unavailable: [] },
  { id: "r-it2", code: "IT2", name: "ห้องปฏิบัติการคอมพิวเตอร์ IT2", capacity: 40, type: "computer", equipment: COMP, unavailable: [] },
  { id: "r-it3", code: "IT3", name: "ห้องปฏิบัติการเครือข่าย IT3", capacity: 36, type: "computer", equipment: [...COMP, "อุปกรณ์เครือข่าย"], unavailable: [] },
  { id: "r-it4", code: "IT4", name: "ห้องปฏิบัติการคอมพิวเตอร์ IT4", capacity: 30, type: "computer", equipment: [...COMP, "GPU"], unavailable: [] },
  { id: "r-it5", code: "IT5", name: "ห้องปฏิบัติการคอมพิวเตอร์ IT5", capacity: 40, type: "computer", equipment: [...COMP, "GPU"], unavailable: [{ day: 3, period: 12 }, { day: 3, period: 13 }] },
  { id: "r-lc03", code: "LC03", name: "ห้องปฏิบัติการภาษา LC03", capacity: 40, type: "language", equipment: ["ชุดหูฟัง", "โปรเจกเตอร์"], unavailable: [] },
  { id: "r-2513", code: "2513", name: "ห้องบรรยาย 2513", capacity: 45, type: "lecture", equipment: ["โปรเจกเตอร์"], unavailable: [] },
  { id: "r-425", code: "425", name: "ห้องบรรยาย 425", capacity: 45, type: "lecture", equipment: ["โปรเจกเตอร์"], unavailable: [] },
  { id: "r-act", code: "กิจกรรม", name: "ลานกิจกรรม", capacity: 300, type: "activity", equipment: [], unavailable: [] },
  { id: "r-wp", code: "สถานประกอบการ", name: "สถานประกอบการ (ทวิภาคี)", capacity: 999, type: "external", equipment: [], unavailable: [] },
];

function course(
  code: string,
  name: string,
  t: number,
  p: number,
  n: number,
  blockSizes: number[],
  roomType: Course["roomType"],
  requiredEquipment: string[] = [],
  isActivity = false,
): Course {
  return {
    id: `c-${code}`,
    code,
    name,
    theory: t,
    practice: p,
    credits: n,
    periodsPerWeek: blockSizes.reduce((s, x) => s + x, 0),
    blockSizes,
    roomType,
    requiredEquipment,
    department: code.startsWith("3190") || code.startsWith("2090") ? "เทคโนโลยีสารสนเทศ" : "สามัญสัมพันธ์",
    isActivity,
  };
}

const courses: Course[] = [
  // ปวส.
  course("30000-2002", "กิจกรรมองค์การวิชาชีพ 1", 0, 2, 0, [2], "activity", [], true),
  course("31901-2005", "การพัฒนาซอฟต์แวร์ด้วยเทคโนโลยี Back-End", 1, 4, 3, [1, 2, 2], "computer", ["คอมพิวเตอร์"]),
  course("31901-2008", "การพัฒนาซอฟต์แวร์รูปแบบเดฟออฟส์ (DevOps)", 1, 4, 3, [1, 2, 2], "computer", ["คอมพิวเตอร์"]),
  course("31906-2014", "การสร้างสรรค์งานศิลปะด้วยเจเนอเรทีฟเอไอ", 1, 4, 3, [1, 4], "computer", ["GPU"]),
  course("31901-2002", "ระบบปฏิบัติการเครื่องแม่ข่าย", 1, 4, 3, [1, 2, 2], "computer", ["อุปกรณ์เครือข่าย"]),
  course("31901-2006", "การพัฒนาซอฟต์แวร์เชิงวัตถุ", 1, 4, 3, [1, 2, 2], "computer", ["คอมพิวเตอร์"]),
  course("31901-2013", "การพัฒนาไฮบริดแอปพลิเคชัน", 1, 4, 3, [1, 2, 2], "computer", ["คอมพิวเตอร์"]),
  course("31901-2011", "การจัดการระบบเครือข่าย", 1, 4, 3, [1, 2, 2], "computer", ["อุปกรณ์เครือข่าย"]),
  course("30000-1212", "ภาษาอังกฤษสำหรับงานอาชีพดิจิทัล", 2, 0, 2, [2], "language"),
  course("30000-1221", "การสนทนาภาษาจีนสำหรับการทำงาน", 2, 0, 2, [2], "lecture"),
  course("30000-1407", "คณิตศาสตร์อุตสาหกรรม", 3, 0, 3, [2, 1], "lecture"),
  course("30000-1101", "ทักษะการใช้ภาษาไทยเพื่ออาชีพ", 2, 0, 2, [2], "lecture"),
  // ปวช.
  course("20901-2001", "คอมพิวเตอร์และการบำรุงรักษา", 1, 3, 2, [2, 2], "computer", ["คอมพิวเตอร์"]),
  course("20901-2003", "ระบบปฏิบัติการเบื้องต้น", 1, 3, 2, [2, 2], "computer", ["คอมพิวเตอร์"]),
  course("20901-2004", "โปรแกรมกราฟิก", 1, 3, 2, [2, 2], "computer", ["คอมพิวเตอร์"]),
  course("20901-2101", "การเขียนโปรแกรมเว็บ", 1, 3, 2, [2, 2], "computer", ["คอมพิวเตอร์"]),
  course("20000-1201", "ภาษาอังกฤษในชีวิตจริง", 0, 2, 1, [2], "language"),
  course("20000-1401", "คณิตศาสตร์พื้นฐานอาชีพ", 2, 0, 2, [2], "lecture"),
  course("20000-1101", "ภาษาไทยพื้นฐาน", 2, 0, 2, [2], "lecture"),
  course("20000-2001", "กิจกรรมลูกเสือวิสามัญ 1", 0, 2, 0, [2], "activity", [], true),
];

const C = (code: string) => `c-${code}`;

function teacher(
  n: number,
  prefix: string,
  firstName: string,
  lastName: string,
  position: string,
  department: string,
  qualified: string[],
  extra: Partial<Teacher> = {},
): Teacher {
  const id = `t${String(n).padStart(2, "0")}`;
  return {
    id,
    code: `T${String(n).padStart(3, "0")}`,
    prefix,
    firstName,
    lastName,
    position,
    degree: "ปริญญาตรี",
    department,
    qualifiedCourseIds: qualified.map(C),
    unavailable: [],
    preferredOff: [],
    maxPerDay: 8,
    maxPerWeek: 30,
    ...extra,
  };
}

const IT = "เทคโนโลยีสารสนเทศและการสื่อสาร";
const GE = "สามัญสัมพันธ์";

const teachers: Teacher[] = [
  teacher(1, "นาย", "สมชาย", "ใจดี", "ข้าราชการครู", IT, ["31901-2006", "31901-2011", "30000-2002", "31901-2002"]),
  teacher(2, "นาย", "วีระพงษ์", "ทองคำ", "ครูพิเศษ", IT, ["31901-2006", "31901-2002", "20901-2101"]),
  teacher(3, "นาย", "ธนากร", "พรมมา", "ครูพิเศษ", IT, ["31901-2002", "31901-2011", "20901-2101"]),
  teacher(4, "นางสาว", "กมลวรรณ", "ศรีสุข", "ข้าราชการครู", IT, ["31901-2008", "30000-2002", "31901-2005"], { specialDuty: "หัวหน้าแผนกวิชา", degree: "ปริญญาโท" }),
  teacher(5, "นาย", "ปกรณ์", "วงศ์สวัสดิ์", "ข้าราชการครู", IT, ["31901-2005", "31901-2008", "31906-2014", "30000-2002"], {
    specialDuty: "หัวหน้างานศูนย์ดิจิทัลและสื่อสารองค์กร",
    degree: "วิทยาศาสตรมหาบัณฑิต",
    maxPerWeek: 34,
    unavailable: [{ day: 3, period: 12 }, { day: 3, period: 13 }],
  }),
  teacher(6, "นางสาว", "พิมพ์ชนก", "แก้วมณี", "ข้าราชการครู", IT, ["31901-2008", "30000-2002", "31901-2013"]),
  teacher(7, "นาย", "อนุชา", "บุญมา", "ครูพิเศษ", IT, ["20901-2001", "20000-2001", "20901-2003"]),
  teacher(8, "นางสาว", "ศิริพร", "รุ่งเรือง", "ครูพิเศษ", IT, ["20901-2003", "20000-2001", "20901-2001"]),
  teacher(9, "นาย", "สุรเชษฐ์", "มีสุข", "พนักงานราชการ", IT, ["31901-2013", "20901-2004", "20000-2001"]),
  teacher(10, "นางสาว", "อรอุมา", "สายทอง", "ครูพิเศษ", IT, ["31906-2014", "20901-2004"]),
  teacher(11, "นาง", "วันเพ็ญ", "ประเสริฐ", "ข้าราชการครู", GE, ["30000-1212", "20000-1201"], {
    preferredOff: [{ day: 4, period: 7 }, { day: 4, period: 8 }, { day: 4, period: 9 }],
  }),
  teacher(12, "นางสาว", "หลิน", "จันทร์เพ็ญ", "ครูพิเศษ", GE, ["30000-1221"]),
  teacher(13, "นางสาว", "วิไลวรรณ", "สุขสม", "ข้าราชการครู", GE, ["30000-1407", "20000-1401"]),
  teacher(14, "นาย", "ประสิทธิ์", "ทองดี", "ข้าราชการครู", GE, ["30000-1101", "20000-1101"]),
];

const groups: StudentGroup[] = [
  { id: "g-sit11", code: "สIT.1/1", name: "ปวส.1 เทคโนโลยีสารสนเทศ กลุ่ม 1", level: "ปวส.", department: IT, size: 17, advisorTeacherId: "t05" },
  { id: "g-sit12", code: "สIT.1/2", name: "ปวส.1 เทคโนโลยีสารสนเทศ กลุ่ม 2", level: "ปวส.", department: IT, size: 29, advisorTeacherId: "t06", note: "จบ.ม.6,ต่างสาขา" },
  { id: "g-sit21", code: "สIT.2/1", name: "ปวส.2 เทคโนโลยีสารสนเทศ กลุ่ม 1 (ทวิภาคี)", level: "ปวส.", department: IT, size: 25, advisorTeacherId: "t04", note: "ทวิภาคี" },
  { id: "g-sit22", code: "สIT.2/2", name: "ปวส.2 เทคโนโลยีสารสนเทศ กลุ่ม 2", level: "ปวส.", department: IT, size: 36, advisorTeacherId: "t01" },
  { id: "g-cit11", code: "ชIT.1/1", name: "ปวช.1 เทคโนโลยีสารสนเทศ", level: "ปวช.", department: IT, size: 32, advisorTeacherId: "t07" },
  { id: "g-cit21", code: "ชIT.2/1", name: "ปวช.2 เทคโนโลยีสารสนเทศ", level: "ปวช.", department: IT, size: 30, advisorTeacherId: "t08" },
  { id: "g-cit31", code: "ชIT.3/1", name: "ปวช.3 เทคโนโลยีสารสนเทศ", level: "ปวช.", department: IT, size: 28, advisorTeacherId: "t09" },
];

let aSeq = 0;
function asg(courseCode: string, teacherId: string, groupIds: string[], extra: Partial<Assignment> = {}): Assignment {
  aSeq += 1;
  return { id: `a-${String(aSeq).padStart(3, "0")}`, courseId: C(courseCode), teacherId, groupIds, ...extra };
}

function buildAssignments(): Assignment[] {
  aSeq = 0;
  return [
    // สIT.1/1
    asg("31901-2005", "t05", ["g-sit11"]),
    asg("31901-2008", "t05", ["g-sit11"]),
    asg("31906-2014", "t05", ["g-sit11"]),
    asg("30000-2002", "t05", ["g-sit11"]),
    asg("31901-2006", "t01", ["g-sit11"]),
    asg("30000-1212", "t11", ["g-sit11"]),
    asg("30000-1221", "t12", ["g-sit11"]),
    asg("30000-1407", "t13", ["g-sit11"]), // a-008 (มีนักเรียน สIT.2/2 ลงเรียนซ้ำ)
    asg("30000-1101", "t14", ["g-sit11"]),
    // สIT.1/2
    asg("31901-2005", "t05", ["g-sit12"]),
    asg("31901-2008", "t05", ["g-sit12"]),
    asg("31901-2006", "t02", ["g-sit12"]),
    asg("31901-2002", "t03", ["g-sit12"]),
    asg("30000-2002", "t06", ["g-sit12"]),
    asg("30000-1212", "t11", ["g-sit12"]),
    asg("30000-1221", "t12", ["g-sit12"]),
    asg("30000-1407", "t13", ["g-sit12"]),
    // สIT.2/1 (ทวิภาคี — ฝึกที่สถานประกอบการ)
    asg("31901-2008", "t06", ["g-sit21"], { fixedRoomId: "r-wp" }),
    asg("31901-2013", "t09", ["g-sit21"]),
    asg("31901-2011", "t01", ["g-sit21"]),
    asg("31906-2014", "t10", ["g-sit21"]),
    asg("30000-2002", "t04", ["g-sit21"]),
    asg("30000-1212", "t11", ["g-sit21"]),
    // สIT.2/2
    asg("31901-2008", "t04", ["g-sit22"]),
    asg("31901-2013", "t09", ["g-sit22"]),
    asg("31901-2011", "t03", ["g-sit22"]),
    asg("31901-2002", "t02", ["g-sit22"]),
    asg("30000-2002", "t01", ["g-sit22"]),
    asg("30000-1221", "t12", ["g-sit22"]),
    asg("30000-1407", "t13", ["g-sit22"]),
    // ชIT.1/1
    asg("20901-2001", "t07", ["g-cit11"]),
    asg("20901-2003", "t08", ["g-cit11"]),
    asg("20901-2004", "t10", ["g-cit11"]),
    asg("20000-1201", "t11", ["g-cit11"]),
    asg("20000-1401", "t13", ["g-cit11"]),
    asg("20000-1101", "t14", ["g-cit11"]),
    // ชIT.2/1
    asg("20901-2004", "t10", ["g-cit21"]),
    asg("20901-2101", "t02", ["g-cit21"]),
    asg("20901-2003", "t08", ["g-cit21"]),
    asg("20901-2001", "t07", ["g-cit21"]),
    asg("20000-1201", "t11", ["g-cit21"]),
    asg("20000-1401", "t13", ["g-cit21"]),
    // ชIT.3/1
    asg("20901-2101", "t03", ["g-cit31"]),
    asg("20901-2004", "t09", ["g-cit31"]),
    asg("20901-2001", "t07", ["g-cit31"]),
    asg("20000-1101", "t14", ["g-cit31"]),
    // ลูกเสือ ปวช. เรียนรวม 3 กลุ่ม
    asg("20000-2001", "t08", ["g-cit11", "g-cit21", "g-cit31"], { fixedRoomId: "r-act" }),
  ];
}

function buildActivities(): LockedActivity[] {
  const homeRooms: LockedActivity[] = groups.map((g) => ({
    id: `act-hr-${g.id}`,
    code: "Home Room",
    name: "กิจกรรมโฮมรูม (ชั่วโมงพบครูที่ปรึกษา)",
    day: 2,
    startPeriod: 7,
    length: 1,
    appliesToAll: false,
    teacherIds: g.advisorTeacherId ? [g.advisorTeacherId] : [],
    groupIds: [g.id],
    countsAsLoad: true,
  }));
  return [
    ...homeRooms,
    {
      id: "act-plc-it",
      code: "PLC",
      name: "ชุมชนการเรียนรู้ทางวิชาชีพ (PLC)",
      day: 2,
      startPeriod: 10,
      length: 2,
      appliesToAll: false,
      teacherIds: teachers.filter((t) => t.department === IT).map((t) => t.id),
      groupIds: [],
      countsAsLoad: true,
    },
  ];
}

const FIRST = ["กิตติ", "ณัฐวุฒิ", "ธนพล", "พัชรา", "ศุภชัย", "อารยา", "วรวุฒิ", "ชนิดา", "ภานุ", "สุนิสา", "ปิยะ", "จิราพร", "ธีรภัทร", "กัญญา", "ณัฐธิดา", "อภิชาติ", "ปวีณา", "ศักดิ์ชัย", "มณีรัตน์", "ทศพล"];
const LAST = ["ศรีสวัสดิ์", "ทองมา", "แก้วกล้า", "บุญเรือง", "สุขเจริญ", "มั่นคง", "รัตนพันธ์", "ใจงาม", "พรหมวงศ์", "เพชรดี", "สมบูรณ์", "ชัยมงคล"];

function buildStudents(): Student[] {
  const out: Student[] = [];
  let k = 0;
  groups.forEach((g, gi) => {
    for (let i = 0; i < g.size; i++) {
      const first = FIRST[(k * 7 + i) % FIRST.length];
      const last = LAST[(k * 5 + gi) % LAST.length];
      out.push({
        id: `s-${g.id.slice(2)}-${String(i + 1).padStart(2, "0")}`,
        code: `69${String(gi + 1).padStart(2, "0")}${String(i + 1).padStart(3, "0")}`,
        displayName: `${first} ${last}`,
        groupId: g.id,
        extraAssignmentIds: [],
      });
      k++;
    }
  });
  // นักเรียน สIT.2/2 จำนวน 3 คน ลงเรียนซ้ำวิชาคณิตศาสตร์อุตสาหกรรมกับ สIT.1/1 (a-008)
  out.filter((s) => s.groupId === "g-sit22").slice(0, 3).forEach((s) => s.extraAssignmentIds.push("a-008"));
  return out;
}

export function createMockDataset(): Dataset {
  return {
    school: {
      id: "school-demo",
      name: "วิทยาลัยเทคนิคตัวอย่าง (ข้อมูลจำลอง)",
      regularEndTime: "16:30",
      signatories: [
        { name: "นางสาวกมลวรรณ ศรีสุข", title: "หัวหน้าแผนกวิชา" },
        { name: "นางสาวรัตนา ดวงดี", title: "หัวหน้างานพัฒนาหลักสูตรฯ" },
        { name: "นางสมใจ พึ่งบุญ", title: "รองผู้อำนวยการฝ่ายวิชาการ" },
        { name: "นายวิชัย เกียรติก้อง", title: "ผู้อำนวยการ" },
      ],
    },
    term: { id: "term-2-2569", year: "2569", term: "2", status: "active" },
    time: {
      days: THAI_DAYS.map((d) => ({ ...d })),
      periods: hourlyPeriods(),
      preActivity: { label: "กิจกรรมหน้าเสาธง", start: "08:00", end: "08:30" },
    },
    courses: courses.map((c) => ({ ...c, blockSizes: [...c.blockSizes], requiredEquipment: [...c.requiredEquipment] })),
    teachers: teachers.map((t) => ({ ...t })),
    rooms: rooms.map((r) => ({ ...r })),
    groups: groups.map((g) => ({ ...g })),
    students: buildStudents(),
    assignments: buildAssignments(),
    activities: buildActivities(),
  };
}
