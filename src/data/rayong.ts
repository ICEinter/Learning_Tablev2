/**
 * ข้อมูลจริง: วิทยาลัยเทคนิคระยอง แผนกวิชาเทคโนโลยีสารสนเทศและการสื่อสาร (รหัส 901)
 * ภาคเรียนที่ 2 ปีการศึกษา 2569
 * รวบรวมและออกแบบคอลเลกชันตรงตามไฟล์ที่แนบ 100%
 */
import type {
  Assignment,
  Course,
  Dataset,
  DayDef,
  Period,
  Placement,
  Room,
  Student,
  StudentGroup,
  Teacher,
  TimetableVersion,
  WorkloadRule,
} from "@/shared/types";

export const RAYONG_DAYS: DayDef[] = [
  { index: 0, label: "วันจันทร์", short: "จ.", active: true },
  { index: 1, label: "วันอังคาร", short: "อ.", active: true },
  { index: 2, label: "วันพุธ", short: "พ.", active: true },
  { index: 3, label: "วันพฤหัสบดี", short: "พฤ.", active: true },
  { index: 4, label: "วันศุกร์", short: "ศ.", active: true },
  { index: 5, label: "วันเสาร์", short: "ส.", active: false },
  { index: 6, label: "วันอาทิตย์", short: "อา.", active: false },
];

export function rayongPeriods(): Period[] {
  // คาบ 1–13 (08:30–21:30) มีกิจกรรมหน้าเสาธง 08:00–08:30 และพักเที่ยงคาบ 4 (11:30–12:30)
  return [
    { no: 1, start: "08:30", end: "09:30" },
    { no: 2, start: "09:30", end: "10:30" },
    { no: 3, start: "10:30", end: "11:30" },
    { no: 4, start: "11:30", end: "12:30" },
    { no: 5, start: "12:30", end: "13:30" },
    { no: 6, start: "13:30", end: "14:30" },
    { no: 7, start: "14:30", end: "15:30" },
    { no: 8, start: "15:30", end: "16:30" },
    { no: 9, start: "16:30", end: "17:30" },
    { no: 10, start: "17:30", end: "18:30" },
    { no: 11, start: "18:30", end: "19:30" },
    { no: 12, start: "19:30", end: "20:30" },
    { no: 13, start: "20:30", end: "21:30" },
  ];
}

/** เกณฑ์ชั่วโมงสอนตามไฟล์แนบ */
export const RAYONG_WORKLOAD_RULES: WorkloadRule[] = [
  { id: "rule-1", name: "ครูปกติ สอน ปวช.", role: "teacher", level: "ปวช.", standardHours: 18 },
  { id: "rule-2", name: "ครูปกติ สอน ปวส.", role: "teacher", level: "ปวส.", standardHours: 15 },
  { id: "rule-3", name: "หน.งาน/หน.แผนก สอน ปวช.", role: "head", level: "ปวช.", standardHours: 12 },
  { id: "rule-4", name: "หน.งาน/หน.แผนก สอน ปวส.", role: "head", level: "ปวส.", standardHours: 10 },
];

export function createRayongDataset(): Dataset {
  const rooms: Room[] = [
    { id: "r-it4", code: "IT4", name: "ห้องปฏิบัติการคอมพิวเตอร์ IT4", capacity: 50, type: "computer", equipment: ["คอมพิวเตอร์", "GPU"], unavailable: [] },
    { id: "r-it5", code: "IT5", name: "ห้องปฏิบัติการคอมพิวเตอร์ IT5", capacity: 50, type: "computer", equipment: ["คอมพิวเตอร์", "GPU"], unavailable: [] },
    { id: "r-wp", code: "สถานประกอบการ", name: "สถานประกอบการ (ทวิภาคี)", capacity: 999, type: "external", equipment: [], unavailable: [] },
    { id: "r-act", code: "กิจกรรม", name: "ลานกิจกรรม / พื้นที่กิจกรรม", capacity: 300, type: "activity", equipment: [], unavailable: [] },
    { id: "r-it1", code: "IT1", name: "ห้องปฏิบัติการคอมพิวเตอร์ IT1", capacity: 50, type: "computer", equipment: ["คอมพิวเตอร์"], unavailable: [] },
    { id: "r-it2", code: "IT2", name: "ห้องปฏิบัติการคอมพิวเตอร์ IT2", capacity: 50, type: "computer", equipment: ["คอมพิวเตอร์"], unavailable: [] },
    { id: "r-it3", code: "IT3", name: "ห้องปฏิบัติการเครือข่าย IT3", capacity: 50, type: "computer", equipment: ["คอมพิวเตอร์", "อุปกรณ์เครือข่าย"], unavailable: [] },
    { id: "r-lec", code: "2513", name: "ห้องบรรยาย 2513", capacity: 50, type: "lecture", equipment: ["โปรเจกเตอร์"], unavailable: [] },
  ];

  const teachers: Teacher[] = [
    {
      id: "t-901001",
      code: "901001",
      prefix: "นางสาว",
      firstName: "ทัศนีย์",
      lastName: "โชติภักดี",
      position: "หัวหน้าแผนกวิชาเทคโนโลยีสารสนเทศ",
      specialDuty: "หัวหน้าแผนกวิชาเทคโนโลยีสารสนเทศ",
      degree: "ศึกษาศาสตรบัณฑิต",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 8,
      maxPerWeek: 32,
    },
    {
      id: "t-901002",
      code: "901002",
      prefix: "นาย",
      firstName: "ปริญญา",
      lastName: "จำเนียรพล",
      position: "หัวหน้างานศูนย์ดิจิทัลและสื่อสารองค์กร",
      specialDuty: "หัวหน้างานศูนย์ดิจิทัลและสื่อสารองค์กร",
      degree: "วิทยาศาสตรมหาบัณฑิต",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 10,
      maxPerWeek: 35, // มีภาระสอนจริง 33 ชม. (รวมกิจกรรม 2 ชม. + PLC 2 ชม.)
    },
    {
      id: "t-901003",
      code: "901003",
      prefix: "นาย",
      firstName: "คมสรรค์",
      lastName: "ภูทอง",
      position: "ครูผู้สอน",
      degree: "ครุศาสตรอุตสาหกรรมดุษฎีบัณฑิต",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 8,
      maxPerWeek: 30,
    },
    {
      id: "t-901004",
      code: "901004",
      prefix: "นางสาว",
      firstName: "ปิติณัช",
      lastName: "พุกอ่อน",
      position: "หัวหน้างานส่งเสริมธุรกิจและการเป็นผู้ประกอบการ",
      specialDuty: "หัวหน้างานส่งเสริมธุรกิจและการเป็นผู้ประกอบการ",
      degree: "วิทยาศาสตรมหาบัณฑิต",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 8,
      maxPerWeek: 30,
    },
    {
      id: "t-901005",
      code: "901005",
      prefix: "นาย",
      firstName: "สันติชัย",
      lastName: "มีชอบ",
      position: "ครูผู้สอน",
      degree: "วิทยาศาสตรบัณฑิต",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 8,
      maxPerWeek: 30,
    },
    {
      id: "t-901006",
      code: "901006",
      prefix: "นาย",
      firstName: "จักรกฤษณ์",
      lastName: "ทับทิมทอง",
      position: "ครูผู้สอน",
      degree: "วิทยาศาสตรบัณฑิต",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 8,
      maxPerWeek: 30,
    },
    {
      id: "t-901007",
      code: "901007",
      prefix: "นาย",
      firstName: "ภูบดี",
      lastName: "แผ่ตระกูล",
      position: "ครูผู้สอน",
      degree: "Bachelor of Education",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 8,
      maxPerWeek: 30,
    },
    {
      id: "t-901008",
      code: "901008",
      prefix: "นางสาว",
      firstName: "สุภัค",
      lastName: "พุ่มจำปา",
      position: "ครูผู้สอน",
      degree: "ครุศาสตรอุตสาหกรรมบัณฑิต",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 8,
      maxPerWeek: 30,
    },
    {
      id: "t-901009",
      code: "901009",
      prefix: "นาย",
      firstName: "ชนาวีร์",
      lastName: "พรเอนก",
      position: "ครูผู้สอน",
      degree: "ครุศาสตรอุตสาหกรรมบัณฑิต",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 8,
      maxPerWeek: 30,
    },
    {
      id: "t-901010",
      code: "901010",
      prefix: "นางสาว",
      firstName: "ศิริอาภา",
      lastName: "ทองเพ็ง",
      position: "ครูผู้สอน",
      degree: "ครุศาสตรอุตสาหกรรมบัณฑิต",
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      qualifiedCourseIds: [],
      unavailable: [],
      preferredOff: [],
      maxPerDay: 8,
      maxPerWeek: 30,
    },
  ];

  // ครบ 12 กลุ่มเรียนตามไฟล์แนบ
  const groups: StudentGroup[] = [
    { id: "g-672190101", code: "672190101", name: "เทคโนโลยีสารสนเทศ 3/1", level: "ปวช.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 20 },
    { id: "g-672190102", code: "672190102", name: "เทคโนโลยีสารสนเทศ 3/2", level: "ปวช.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 20 },
    { id: "g-672190103", code: "672190103", name: "เทคโนโลยีสารสนเทศ 3/3", level: "ปวช.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 20 },
    { id: "g-682190101", code: "682190101", name: "เทคโนโลยีสารสนเทศและการสื่อสาร 2/1", level: "ปวช.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 22 },
    { id: "g-682190102", code: "682190102", name: "เทคโนโลยีสารสนเทศและการสื่อสาร 2/2", level: "ปวช.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 22 },
    { id: "g-682190103", code: "682190103", name: "เทคโนโลยีสารสนเทศและการสื่อสาร 2/3", level: "ปวช.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 22 },
    { id: "g-692190101", code: "692190101", name: "เทคโนโลยีสารสนเทศ 1/1", level: "ปวช.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 20 },
    { id: "g-692190102", code: "692190102", name: "เทคโนโลยีสารสนเทศ 1/2", level: "ปวช.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 20 },
    { id: "g-683190101", code: "683190101", name: "เทคโนโลยีสารสนเทศ 2/1", level: "ปวส.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 25 },
    { id: "g-683190102", code: "683190102", name: "เทคโนโลยีสารสนเทศ 2/2", level: "ปวส.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 36, note: "ม.6,ต่างสาขา" },
    { id: "g-693190101", code: "693190101", name: "เทคโนโลยีสารสนเทศ 1/1", level: "ปวส.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 17 },
    { id: "g-693190102", code: "693190102", name: "เทคโนโลยีสารสนเทศ 1/2", level: "ปวส.", department: "เทคโนโลยีสารสนเทศและการสื่อสาร", size: 29, note: "จบ.ม.6,ต่างสาขา" },
  ];

  function makeCourse(
    code: string,
    name: string,
    t: number,
    p: number,
    c: number,
    blocks: number[],
    roomType: Course["roomType"] = "computer",
    isAct = false,
  ): Course {
    return {
      id: `c-${code}`,
      code,
      name,
      theory: t,
      practice: p,
      credits: c,
      periodsPerWeek: blocks.reduce((a, b) => a + b, 0),
      blockSizes: blocks,
      roomType,
      requiredEquipment: roomType === "computer" ? ["คอมพิวเตอร์"] : [],
      department: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      isActivity: isAct,
    };
  }

  const courses: Course[] = [
    makeCourse("30000-2002", "กิจกรรมองค์การวิชาชีพ 1", 0, 2, 0, [2], "activity", true),
    makeCourse("31901-2005", "การพัฒนาซอฟต์แวร์ด้วยเทคโนโลยี Back-End", 1, 4, 3, [2, 3], "computer"),
    makeCourse("31901-2008", "การพัฒนาซอฟต์แวร์รูปแบบเดฟออฟส์ (DevOps)", 1, 4, 3, [2, 3], "computer"),
    makeCourse("31906-2014", "การสร้างสรรค์งานศิลปะด้วยเจเนอเรทีฟเอไอ", 1, 4, 3, [3, 2], "computer"),
    makeCourse("PLC", "ชุมชนการเรียนรู้ทางวิชาชีพ (PLC)", 0, 2, 0, [2], "lecture", true),
    makeCourse("20001-1004", "กฎหมายแรงงาน", 1, 0, 1, [1], "lecture"),
    makeCourse("21900-1001", "การเขียนโปรแกรมคอมพิวเตอร์", 1, 2, 2, [3], "computer"),
    makeCourse("21900-1004", "หลักการวิเคราะห์และออกแบบระบบเชิงวัตถุ", 1, 2, 2, [3], "computer"),
    makeCourse("21901-2008", "การออกแบบส่วนติดต่อผู้ใช้", 1, 2, 2, [3], "computer"),
    makeCourse("21901-2001", "ภาษาสอบถามข้อมูลเชิงโครงสร้างเบื้องต้น", 1, 2, 2, [3], "computer"),
    makeCourse("21901-2004", "การซ่อมและบำรุงรักษาคอมพิวเตอร์", 1, 3, 2, [4], "computer"),
    makeCourse("21901-2010", "การสร้างภาพเคลื่อนไหวเบื้องต้น", 1, 4, 3, [5], "computer"),
    makeCourse("21910-2005", "โปรแกรมตารางคำนวณ", 1, 2, 2, [3], "computer"),
    makeCourse("20001-1001", "สุขภาพความปลอดภัยและสิ่งแวดล้อม", 1, 2, 2, [3], "lecture"),
    makeCourse("20001-1002", "การพัฒนาอย่างยั่งยืน", 1, 2, 2, [3], "lecture"),
    makeCourse("20001-1003", "ธุรกิจเบื้องต้น", 1, 2, 2, [3], "lecture"),
    makeCourse("21901-2007", "เทคโนโลยีระบบสมองกลฝังตัวและไอโอที", 1, 2, 2, [3], "computer"),
    makeCourse("21901-2015", "การติดตั้งระบบเครือข่ายคอมพิวเตอร์เบื้องต้น", 1, 3, 2, [4], "computer"),
    makeCourse("21901-2017", "เทคโนโลยีการนำเข้าข้อมูลเข้าสู่ระบบคอมพิวเตอร์", 1, 2, 2, [3], "computer"),
    makeCourse("21910-2021", "สื่อโมชันกราฟิก", 2, 2, 3, [4], "computer"),
    makeCourse("21901-2019", "ปฏิบัติงานซ่อมและบำรุงรักษาคอมพิวเตอร์", 0, 6, 2, [2], "computer"),
    makeCourse("21901-2020", "ปฏิบัติงานบริการคอมพิวเตอร์และเทคโนโลยีสารสนเทศ", 0, 6, 2, [2], "computer"),
    makeCourse("21901-2009", "การสร้างเกมคอมพิวเตอร์", 1, 4, 3, [5], "computer"),
    makeCourse("21901-2011", "การพัฒนาแอปพลิเคชันบนอุปกรณ์เคลื่อนที่", 1, 4, 3, [5], "computer"),
    makeCourse("21901-2012", "การพัฒนาระบบร่วมกันด้วยแพลตฟอร์ม", 1, 2, 2, [3], "computer"),
    makeCourse("21901-2021", "โครงงานด้านเทคโนโลยีสารสนเทศ", 0, 12, 4, [4], "computer"),
    makeCourse("31901-2002", "ระบบปฏิบัติการเครื่องแม่ข่าย", 1, 4, 3, [5], "computer"),
    makeCourse("31901-2006", "การพัฒนาซอฟต์แวร์เชิงวัตถุ", 1, 4, 3, [5], "computer"),
    makeCourse("31901-2011", "การจัดการระบบเครือข่าย", 1, 4, 3, [5], "computer"),
    makeCourse("31901-2013", "การพัฒนาไฮบริดแอพพลิเคชั่น", 1, 4, 3, [5], "computer"),
    makeCourse("31900-0003", "ระบบฐานข้อมูลและการประยุกต์", 1, 4, 3, [5], "computer"),
    makeCourse("31900-0004", "ระบบเครือข่ายคอมพิวเตอร์", 1, 4, 3, [5], "computer"),
    makeCourse("31900-1003", "การสร้างสื่อดิจิทัล", 1, 4, 3, [2], "computer"),
    makeCourse("31901-2003", "การวิเคราะห์และออกแบบระบบเชิงวัตถุ", 1, 4, 3, [2], "computer"),
    makeCourse("31901-2012", "การวิเคราะห์และนำเสนอข้อมูล", 1, 4, 3, [2], "computer"),
    makeCourse("31901-2017", "โครงงานด้านเทคโนโลยีสารสนเทศ 2", 0, 6, 2, [2], "computer"),
  ];

  let asgCounter = 1;
  const assignments: Assignment[] = [];
  function addAsg(courseCode: string, teacherCode: string, groupCodes: string[], blockSizes?: number[], fixedRoom?: string): string {
    const c = courses.find((x) => x.code === courseCode);
    if (!c) return "";
    const t = teachers.find((x) => x.code === teacherCode);
    if (!t) return "";
    const gIds = groupCodes.map((code) => groups.find((g) => g.code === code)?.id).filter(Boolean) as string[];

    const id = `asg-${String(asgCounter++).padStart(3, "0")}`;
    assignments.push({
      id,
      courseId: c.id,
      teacherId: t.id,
      groupIds: gIds,
      ...(blockSizes ? { blockSizes, periodsPerWeek: blockSizes.reduce((a, b) => a + b, 0) } : {}),
      ...(fixedRoom ? { fixedRoomId: fixedRoom } : {}),
    });
    return id;
  }

  // ปวช.1 (1/1, 1/2 เรียนรวม)
  const gPvc1 = ["692190101", "692190102"];
  addAsg("20001-1004", "901001", gPvc1); // ทัศนีย์
  addAsg("21900-1001", "901006", gPvc1); // จักรกฤษณ์
  addAsg("21900-1004", "901008", gPvc1); // สุภัค
  addAsg("21901-2008", "901008", gPvc1); // สุภัค
  addAsg("21901-2001", "901004", gPvc1); // ปิติณัช
  addAsg("21901-2004", "901006", gPvc1); // จักรกฤษณ์
  addAsg("21901-2010", "901007", gPvc1); // ภูบดี
  addAsg("21910-2005", "901004", gPvc1); // ปิติณัช

  // ปวช.2 (2/1, 2/2 เรียนรวม)
  const gPvc2 = ["682190101", "682190102"];
  addAsg("20001-1001", "901006", gPvc2); // จักรกฤษณ์
  addAsg("20001-1002", "901001", gPvc2); // ทัศนีย์
  addAsg("20001-1003", "901004", gPvc2); // ปิติณัช
  addAsg("21901-2001", "901004", gPvc2); // ปิติณัช
  addAsg("21901-2007", "901009", gPvc2); // ชนาวีร์
  addAsg("21901-2015", "901006", gPvc2); // จักรกฤษณ์
  addAsg("21901-2017", "901001", gPvc2); // ทัศนีย์
  addAsg("21910-2021", "901001", gPvc2); // ทัศนีย์

  // ปวช.3 (3/1, 3/2 เรียนรวม)
  const gPvc3 = ["672190101", "672190102"];
  addAsg("21901-2019", "901001", gPvc3); // ทัศนีย์
  addAsg("21901-2020", "901007", gPvc3); // ภูบดี
  addAsg("20001-1004", "901001", gPvc3); // ทัศนีย์
  addAsg("21901-2009", "901008", gPvc3); // สุภัค
  addAsg("21901-2011", "901009", gPvc3); // ชนาวีร์
  addAsg("21901-2012", "901009", gPvc3); // ชนาวีร์
  addAsg("21901-2021", "901001", gPvc3); // ทัศนีย์

  // ปวส.1 (1/1, 1/2 เรียนแยก)
  addAsg("31901-2002", "901005", ["693190101"]); // สIT.1/1 - สันติชัย
  addAsg("31901-2002", "901005", ["693190102"]); // สIT.1/2 - สันติชัย
  addAsg("31901-2005", "901002", ["693190101"], [2, 3], "r-it4"); // สIT.1/1 - ปริญญา (5 คาบ)
  addAsg("31901-2005", "901002", ["693190102"], [2, 3], "r-it5"); // สIT.1/2 - ปริญญา (5 คาบ)
  addAsg("31901-2006", "901003", ["693190101"]); // คมสรรค์
  addAsg("31901-2006", "901003", ["693190102"]); // คมสรรค์
  addAsg("31901-2011", "901003", ["693190101"]); // คมสรรค์
  addAsg("31901-2011", "901003", ["693190102"]); // คมสรรค์
  addAsg("31901-2013", "901005", ["693190101"]); // สันติชัย
  addAsg("31901-2013", "901005", ["693190102"]); // สันติชัย
  addAsg("31901-2008", "901002", ["693190101"], [3, 2], "r-it4"); // DevOps สIT.1/1 - ปริญญา (5 คาบ)
  addAsg("31901-2008", "901002", ["693190102"], [2, 3], "r-it5"); // DevOps สIT.1/2 - ปริญญา (5 คาบ)
  addAsg("31906-2014", "901002", ["693190101"], [3, 2], "r-it4"); // AI ศิลปะ สIT.1/1 - ปริญญา (5 คาบ)
  addAsg("30000-2002", "901002", ["693190101"], [2], "r-act");    // กิจกรรม สIT.1/1 - ปริญญา (2 คาบ)
  addAsg("PLC", "901002", ["693190101"], [2], "r-lec");            // PLC - ปริญญา (2 คาบ)

  // ปวส.2 (2/1, 2/2 เรียนแยก)
  addAsg("31900-1003", "901005", ["683190101"]); // สันติชัย
  addAsg("31900-1003", "901005", ["683190102"]); // สันติชัย
  addAsg("31901-2003", "901003", ["683190101"]); // คมสรรค์
  addAsg("31901-2003", "901003", ["683190102"]); // คมสรรค์
  addAsg("31901-2008", "901002", ["683190101"], [2], "r-wp"); // DevOps สถานประกอบการ สIT.2/1 - ปริญญา (2 คาบ)
  addAsg("31901-2008", "901002", ["683190102"], [2], "r-wp"); // DevOps สถานประกอบการ สIT.2/2 - ปริญญา (2 คาบ)
  addAsg("31901-2012", "901005", ["683190101"]); // สันติชัย
  addAsg("31901-2012", "901005", ["683190102"]); // สันติชัย
  addAsg("31901-2017", "901003", ["683190101"]); // คมสรรค์
  addAsg("31901-2017", "901005", ["683190102"]); // สันติชัย

  const students: Student[] = groups.flatMap((g) => [
    {
      id: `s-${g.code}01`,
      code: `${g.code}01`,
      displayName: `นายกิตติ ศรีสวัสดิ์ (${g.name})`,
      groupId: g.id,
      extraAssignmentIds: [],
    },
    {
      id: `s-${g.code}02`,
      code: `${g.code}02`,
      displayName: `นางสาวกานดา มั่นคง (${g.name})`,
      groupId: g.id,
      extraAssignmentIds: [],
    },
  ]);

  return {
    school: {
      id: "school-rayong",
      name: "วิทยาลัยเทคนิคระยอง",
      departmentCode: "901",
      departmentName: "เทคโนโลยีสารสนเทศและการสื่อสาร",
      regularEndTime: "16:30",
      signatories: [
        { title: "หัวหน้าแผนกวิชา", name: "นางสาวทัศนีย์ โชติภักดี" },
        { title: "หัวหน้างานพัฒนาหลักสูตรฯ", name: "นางสาวญาธิดา แสงรัตน์" },
        { title: "รองผู้อำนวยการฝ่ายวิชาการ", name: "นางรักชนก โคตรพันธ์" },
        { title: "ผู้อำนวยการ", name: "นายกิตติพงค์ อุตตมะเวทิน" },
      ],
    },
    term: {
      id: "term-2569-2",
      year: "2569",
      term: "2",
      status: "active",
    },
    time: {
      days: RAYONG_DAYS,
      periods: rayongPeriods(),
      preActivity: {
        label: "กิจกรรมหน้าเสาธง",
        start: "08:00",
        end: "08:30",
      },
    },
    courses,
    teachers,
    rooms,
    groups,
    students,
    assignments,
    activities: [],
    workloadRules: RAYONG_WORKLOAD_RULES,
  };
}

/**
 * สร้างตารางสอนตัวอย่างจริง 33 ชั่วโมงของ อ.ปริญญา จำเนียรพล (901002)
 * ตรงตามตารางทางการในไฟล์แนบ 100%:
 * - วันจันทร์: คาบ 5-7 (3 คาบ) + คาบ 8-9 (2 คาบ) = 31906-2014, IT4, สIT.1/1
 * - วันอังคาร: คาบ 1-2 (2 คาบ) + คาบ 5-7 (3 คาบ) = 31901-2008, IT5, สIT.1/2 (จบ.ม.6,ต่างสาขา)
 * - วันพุธ: คาบ 1-2 (2 คาบ) + คาบ 5-7 (3 คาบ) = 31901-2005, IT4, สIT.1/1
 * - วันพุธ: คาบ 8-9 (2 คาบ) = 30000-2002 กิจกรรม, ลานกิจกรรม, สIT.1/1
 * - วันพุธ: คาบ 10-11 (2 คาบ) = PLC, ห้องบรรยาย 2513
 * - วันพฤหัสบดี: คาบ 1-2 (2 คาบ) + คาบ 5-7 (3 คาบ) = 31901-2005, IT5, สIT.1/2 (จบ.ม.6,ต่างสาขา)
 * - วันศุกร์: คาบ 1-2 (2 คาบ) = 31901-2008, สถานประกอบการ, สIT.2/1
 * - วันศุกร์: คาบ 3-4 (2 คาบ) = 31901-2008, สถานประกอบการ, สIT.2/2
 * - วันศุกร์: คาบ 5-7 (3 คาบ) + คาบ 8-9 (2 คาบ) = 31901-2008, IT4, สIT.1/1
 */
export function createOfficialParinyaPlacements(dataset: Dataset): Placement[] {
  const tParinya = dataset.teachers.find((t) => t.code === "901002");
  if (!tParinya) return [];

  // หา assignment ต่างๆ ของ อ.ปริญญา
  const asgs = dataset.assignments.filter((a) => a.teacherId === tParinya.id);
  const getAsg = (courseCode: string, groupCode: string) => {
    const c = dataset.courses.find((x) => x.code === courseCode);
    const g = dataset.groups.find((x) => x.code === groupCode);
    return asgs.find((a) => a.courseId === c?.id && a.groupIds.includes(g?.id ?? ""));
  };

  const aAi11 = getAsg("31906-2014", "693190101");
  const aDevops12 = getAsg("31901-2008", "693190102");
  const aBack11 = getAsg("31901-2005", "693190101");
  const aAct11 = getAsg("30000-2002", "693190101");
  const aPlc = asgs.find((a) => {
    const c = dataset.courses.find((x) => x.id === a.courseId);
    return c?.code === "PLC";
  });
  const aBack12 = getAsg("31901-2005", "693190102");
  const aDevops21 = getAsg("31901-2008", "683190101");
  const aDevops22 = getAsg("31901-2008", "683190102");
  const aDevops11 = getAsg("31901-2008", "693190101");

  const placements: Placement[] = [];

  // วันจันทร์ (day 0)
  if (aAi11) {
    placements.push({ assignmentId: aAi11.id, block: 0, day: 0, period: 5, roomId: "r-it4" }); // คาบ 5-7 (3 คาบ)
    placements.push({ assignmentId: aAi11.id, block: 1, day: 0, period: 8, roomId: "r-it4" }); // คาบ 8-9 (2 คาบ)
  }

  // วันอังคาร (day 1)
  if (aDevops12) {
    placements.push({ assignmentId: aDevops12.id, block: 0, day: 1, period: 1, roomId: "r-it5" }); // คาบ 1-2 (2 คาบ)
    placements.push({ assignmentId: aDevops12.id, block: 1, day: 1, period: 5, roomId: "r-it5" }); // คาบ 5-7 (3 คาบ)
  }

  // วันพุธ (day 2)
  if (aBack11) {
    placements.push({ assignmentId: aBack11.id, block: 0, day: 2, period: 1, roomId: "r-it4" }); // คาบ 1-2 (2 คาบ)
    placements.push({ assignmentId: aBack11.id, block: 1, day: 2, period: 5, roomId: "r-it4" }); // คาบ 5-7 (3 คาบ)
  }
  if (aAct11) {
    placements.push({ assignmentId: aAct11.id, block: 0, day: 2, period: 8, roomId: "r-act" }); // คาบ 8-9 (2 คาบ)
  }
  if (aPlc) {
    placements.push({ assignmentId: aPlc.id, block: 0, day: 2, period: 10, roomId: "r-lec" }); // คาบ 10-11 (2 คาบ)
  }

  // วันพฤหัสบดี (day 3)
  if (aBack12) {
    placements.push({ assignmentId: aBack12.id, block: 0, day: 3, period: 1, roomId: "r-it5" }); // คาบ 1-2 (2 คาบ)
    placements.push({ assignmentId: aBack12.id, block: 1, day: 3, period: 5, roomId: "r-it5" }); // คาบ 5-7 (3 คาบ)
  }

  // วันศุกร์ (day 4)
  if (aDevops21) {
    placements.push({ assignmentId: aDevops21.id, block: 0, day: 4, period: 1, roomId: "r-wp" }); // คาบ 1-2 (2 คาบ)
  }
  if (aDevops22) {
    placements.push({ assignmentId: aDevops22.id, block: 0, day: 4, period: 3, roomId: "r-wp" }); // คาบ 3-4 (2 คาบ)
  }
  if (aDevops11) {
    placements.push({ assignmentId: aDevops11.id, block: 0, day: 4, period: 5, roomId: "r-it4" }); // คาบ 5-7 (3 คาบ)
    placements.push({ assignmentId: aDevops11.id, block: 1, day: 4, period: 8, roomId: "r-it4" }); // คาบ 8-9 (2 คาบ)
  }

  return placements;
}

export function createOfficialRayongTimetable(dataset: Dataset = createRayongDataset()): TimetableVersion {
  const placements = createOfficialParinyaPlacements(dataset);
  return {
    id: "tt-rayong-official",
    termId: dataset.term.id,
    label: "ตารางสอนทางการ ภาคเรียน 2/2569 (อ.ปริญญา จำเนียรพล)",
    status: "published",
    placements,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    source: { algorithm: "official-import" },
    metrics: { hard: 0, soft: 0, elapsedMs: 0 },
    note: "ตารางสอนทางการ แผนกวิชาเทคโนโลยีสารสนเทศและการสื่อสาร วิทยาลัยเทคนิคระยอง",
  };
}
