/**
 * ชุดข้อมูลสังเคราะห์สำหรับทดสอบและ benchmark (ไม่ใช่ข้อมูลจริง)
 *
 * normal / edge / stress สร้างแบบ "ฝังคำตอบ" (planted solution): สุ่มวางคาบลงตารางที่ว่างจริงก่อน
 * (ครู กลุ่ม ห้อง ไม่ชน ห้องตรงประเภท/อุปกรณ์/ความจุ ไม่ทับคาบพัก/กิจกรรมล็อก ไม่เกิน maxPerDay)
 * แล้วจึงสร้างรายการมอบหมายจากสิ่งที่วางได้ และกำหนดเวลาไม่ว่าง/ภาระสูงสุดให้สอดคล้องกับคำตอบนั้น
 * ⇒ รับประกันว่ามีตารางที่ไม่ละเมิด Hard อย่างน้อย 1 แบบ (ดู createFixtureWithSolution)
 *
 * infeasible-p1..p7 = normal ที่ถูกแก้ให้ละเมิดเงื่อนไขจำเป็นตามกฎนั้น (pre-check ต้องพบหลักฐาน)
 * hard-no-proof = normal + โครงสร้างวงจร 5 รายวิชา (C5) ที่แต่ละคู่ติดกันใช้ครู/กลุ่มร่วมกัน
 *   แต่ละรายวิชา 19 คาบ จาก 45 slot: ทุกคู่รวม 38 ≤ 45 และ clique ใหญ่สุดมี 2 → P1/P2/P7 ไม่พบหลักฐาน
 *   แต่ในแต่ละ slot วางได้ไม่เกิน 2 รายวิชาจาก 5 (independent set ของ C5 = 2) ⇒ ต้องการ 95 > 2×45 = 90
 *   จึงจัดไม่ได้จริง แต่ไม่มีหลักฐานแบบถูกใน P1–P7 → engine ต้องรายงาน timeout/partial ไม่ใช่ infeasible-proven
 */
import { createRng, type Rng } from "@/engine/rng";
import type {
  Assignment,
  Course,
  Dataset,
  DayDef,
  LockedActivity,
  Period,
  Placement,
  Room,
  RoomType,
  Student,
  StudentGroup,
  Teacher,
} from "@/shared/types";

export type FixtureKind =
  | "normal"
  | "edge"
  | "stress"
  | "infeasible-p1"
  | "infeasible-p2"
  | "infeasible-p3"
  | "infeasible-p4"
  | "infeasible-p5"
  | "infeasible-p6"
  | "infeasible-p7"
  | "hard-no-proof";

export const FIXTURE_KINDS: FixtureKind[] = [
  "normal",
  "edge",
  "stress",
  "infeasible-p1",
  "infeasible-p2",
  "infeasible-p3",
  "infeasible-p4",
  "infeasible-p5",
  "infeasible-p6",
  "infeasible-p7",
  "hard-no-proof",
];

const DAY_LABELS: [string, string][] = [
  ["วันจันทร์", "จ."],
  ["วันอังคาร", "อ."],
  ["วันพุธ", "พ."],
  ["วันพฤหัสบดี", "พฤ."],
  ["วันศุกร์", "ศ."],
  ["วันเสาร์", "ส."],
  ["วันอาทิตย์", "อา."],
];

interface RoomSpec {
  type: RoomType;
  count: number;
  cap: [number, number];
  equipment: string[][];
}

interface CourseTpl {
  type: RoomType;
  blocks: number[];
  equipment: string[];
  prefix: string;
  name: string;
}

interface GenCfg {
  label: string;
  activeDays: number;
  periods: number;
  breakAt: number[];
  groups: number;
  teachers: number;
  rooms: RoomSpec[];
  fill: number;
  courses: CourseTpl[];
  /** จำนวนวิชาเลือกร่วม และจำนวนกลุ่มต่อวิชา */
  shared: { count: number; groups: number };
  groupSize: [number, number];
  teacherCapDay: number;
  weekSlack: number;
  extraLocksPerGroup: number;
  allHands: boolean;
  fillHoles: boolean;
  unavailPerTeacher: number;
  prefPerTeacher: number;
  extraStudents: number;
  coursesPerTeacher: number;
}

const TPL: CourseTpl[] = [
  { type: "lecture", blocks: [2, 1], equipment: [], prefix: "30000-11", name: "ภาษาไทยเพื่ออาชีพ" },
  { type: "lecture", blocks: [2], equipment: [], prefix: "30000-12", name: "ภาษาอังกฤษสื่อสาร" },
  { type: "lecture", blocks: [2, 2], equipment: [], prefix: "30000-14", name: "คณิตศาสตร์ประยุกต์" },
  { type: "lecture", blocks: [1, 1], equipment: [], prefix: "30000-15", name: "สังคมศึกษา" },
  { type: "lecture", blocks: [2], equipment: [], prefix: "30000-16", name: "พลศึกษาเพื่อสุขภาพ" },
  { type: "computer", blocks: [2, 2], equipment: ["คอมพิวเตอร์"], prefix: "31901-20", name: "การเขียนโปรแกรม" },
  { type: "computer", blocks: [1, 2], equipment: ["คอมพิวเตอร์"], prefix: "31901-21", name: "ระบบฐานข้อมูล" },
  { type: "computer", blocks: [3], equipment: ["คอมพิวเตอร์", "GPU"], prefix: "31906-20", name: "ปัญญาประดิษฐ์เบื้องต้น" },
  { type: "computer", blocks: [2, 2], equipment: ["อุปกรณ์เครือข่าย"], prefix: "31901-22", name: "เครือข่ายคอมพิวเตอร์" },
  { type: "lab", blocks: [3], equipment: ["ตู้ดูดควัน"], prefix: "30000-13", name: "วิทยาศาสตร์อุตสาหกรรม" },
  { type: "lab", blocks: [2], equipment: [], prefix: "30000-17", name: "ฟิสิกส์ประยุกต์" },
  { type: "workshop", blocks: [3, 2], equipment: [], prefix: "30100-20", name: "งานฝึกฝีมือ" },
  { type: "language", blocks: [2], equipment: ["ชุดหูฟัง"], prefix: "30000-18", name: "การฟังพูดภาษาอังกฤษ" },
];

const FILLER: CourseTpl = { type: "lecture", blocks: [1], equipment: [], prefix: "30000-19", name: "กิจกรรมแนะแนว" };

const FIRST = ["กิตติ", "ณัฐวุฒิ", "ธนพล", "พัชรา", "ศุภชัย", "อารยา", "วรวุฒิ", "ชนิดา", "ภานุ", "สุนิสา", "ปิยะ", "จิราพร", "ธีรภัทร", "กัญญา", "อภิชาติ", "ปวีณา"];
const LAST = ["ศรีสวัสดิ์", "ทองมา", "แก้วกล้า", "บุญเรือง", "สุขเจริญ", "มั่นคง", "รัตนพันธ์", "ใจงาม", "พรหมวงศ์", "เพชรดี"];

const NORMAL: GenCfg = {
  label: "ปกติ",
  activeDays: 5,
  periods: 10,
  breakAt: [5],
  groups: 12,
  teachers: 30,
  rooms: [
    { type: "lecture", count: 9, cap: [36, 48], equipment: [["โปรเจกเตอร์"]] },
    { type: "computer", count: 6, cap: [32, 45], equipment: [["คอมพิวเตอร์"], ["คอมพิวเตอร์", "GPU"], ["คอมพิวเตอร์", "อุปกรณ์เครือข่าย"]] },
    { type: "lab", count: 2, cap: [36, 45], equipment: [["ตู้ดูดควัน"]] },
    { type: "workshop", count: 2, cap: [36, 45], equipment: [[]] },
    { type: "language", count: 1, cap: [40, 45], equipment: [["ชุดหูฟัง"]] },
  ],
  fill: 0.58,
  courses: TPL,
  shared: { count: 1, groups: 3 },
  groupSize: [24, 36],
  teacherCapDay: 7,
  weekSlack: 6,
  extraLocksPerGroup: 0,
  allHands: false,
  fillHoles: false,
  unavailPerTeacher: 2,
  prefPerTeacher: 2,
  extraStudents: 6,
  coursesPerTeacher: 5,
};

const EDGE: GenCfg = {
  label: "ขอบเขตแน่น",
  activeDays: 5,
  periods: 9,
  breakAt: [5],
  groups: 10,
  teachers: 26,
  rooms: [
    { type: "lecture", count: 7, cap: [36, 48], equipment: [["โปรเจกเตอร์"]] },
    { type: "computer", count: 3, cap: [36, 45], equipment: [["คอมพิวเตอร์"], ["คอมพิวเตอร์", "GPU"], ["คอมพิวเตอร์", "อุปกรณ์เครือข่าย"]] },
    { type: "lab", count: 1, cap: [40, 45], equipment: [["ตู้ดูดควัน"]] },
    { type: "workshop", count: 1, cap: [40, 45], equipment: [[]] },
    { type: "language", count: 1, cap: [40, 45], equipment: [["ชุดหูฟัง"]] },
  ],
  fill: 0.95,
  courses: TPL.filter((c) => c.blocks.every((b) => b >= 2) || c.type !== "lecture"),
  shared: { count: 2, groups: 4 },
  groupSize: [24, 34],
  teacherCapDay: 6,
  weekSlack: 0,
  extraLocksPerGroup: 1,
  allHands: true,
  fillHoles: true,
  unavailPerTeacher: 3,
  prefPerTeacher: 2,
  extraStudents: 8,
  coursesPerTeacher: 6,
};

const STRESS: GenCfg = {
  label: "ขนาดใหญ่",
  activeDays: 6,
  periods: 11,
  breakAt: [6],
  groups: 60,
  teachers: 150,
  rooms: [
    { type: "lecture", count: 46, cap: [36, 50], equipment: [["โปรเจกเตอร์"]] },
    { type: "computer", count: 26, cap: [32, 45], equipment: [["คอมพิวเตอร์"], ["คอมพิวเตอร์", "GPU"], ["คอมพิวเตอร์", "อุปกรณ์เครือข่าย"]] },
    { type: "lab", count: 10, cap: [36, 45], equipment: [["ตู้ดูดควัน"], []] },
    { type: "workshop", count: 10, cap: [36, 45], equipment: [[]] },
    { type: "language", count: 8, cap: [40, 45], equipment: [["ชุดหูฟัง"]] },
  ],
  fill: 0.7,
  courses: TPL,
  shared: { count: 6, groups: 3 },
  groupSize: [24, 38],
  teacherCapDay: 7,
  weekSlack: 4,
  extraLocksPerGroup: 0,
  allHands: false,
  fillHoles: false,
  unavailPerTeacher: 2,
  prefPerTeacher: 2,
  extraStudents: 40,
  coursesPerTeacher: 5,
};

export interface FixtureWithSolution {
  dataset: Dataset;
  /** คำตอบที่ฝังไว้ (มีเฉพาะชุดที่สร้างแบบ planted และไม่ได้ถูกแก้ให้เป็นไปไม่ได้) */
  solution?: Placement[];
}

export function createFixture(kind: FixtureKind, seed = 1): Dataset {
  return createFixtureWithSolution(kind, seed).dataset;
}

export function createFixtureWithSolution(kind: FixtureKind, seed = 1): FixtureWithSolution {
  switch (kind) {
    case "normal":
      return generate(NORMAL, seed);
    case "edge":
      return generate(EDGE, seed);
    case "stress":
      return generate(STRESS, seed);
    case "hard-no-proof":
      return { dataset: hardNoProof(generate(NORMAL, seed).dataset) };
    default:
      return { dataset: makeInfeasible(kind, generate(NORMAL, seed).dataset, createRng(seed * 7919 + 13)) };
  }
}

// ---------------------------------------------------------------------------

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function buildTime(cfg: GenCfg) {
  const days: DayDef[] = DAY_LABELS.map(([label, short], i) => ({ index: i, label, short, active: i < cfg.activeDays }));
  const periods: Period[] = [];
  let min = 8 * 60;
  for (let i = 1; i <= cfg.periods; i++) {
    const br = cfg.breakAt.includes(i);
    const len = 60;
    const st = `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
    min += len;
    const en = `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
    periods.push(br ? { no: i, start: st, end: en, isBreak: true, label: "พักกลางวัน" } : { no: i, start: st, end: en });
  }
  return { days, periods, preActivity: { label: "กิจกรรมหน้าเสาธง", start: "07:45", end: "08:00" } };
}

function generate(cfg: GenCfg, seed: number): FixtureWithSolution {
  const rng = createRng(seed * 104729 + cfg.groups);
  const time = buildTime(cfg);
  const D = 7;
  const P = cfg.periods;
  const S = D * P;
  const gridOk = (s: number) => Math.floor(s / P) < cfg.activeDays && !cfg.breakAt.includes((s % P) + 1);

  // ---- rooms
  const rooms: Room[] = [];
  for (const spec of cfg.rooms)
    for (let i = 0; i < spec.count; i++) {
      const eq = spec.equipment[i % spec.equipment.length];
      rooms.push({
        id: `r-${spec.type}-${pad(i + 1)}`,
        code: `${spec.type.slice(0, 3).toUpperCase()}${pad(i + 1)}`,
        name: `ห้อง ${spec.type} ${i + 1}`,
        capacity: spec.cap[0] + rng.int(spec.cap[1] - spec.cap[0] + 1),
        type: spec.type,
        equipment: [...eq],
        unavailable: [],
      });
    }
  // ห้องประชุมใหญ่สำหรับวิชาเลือกร่วม
  rooms.push({ id: "r-hall-01", code: "HALL1", name: "ห้องประชุมใหญ่", capacity: 200, type: "lecture", equipment: ["โปรเจกเตอร์"], unavailable: [] });

  // ---- courses
  const courses: Course[] = [];
  const tplOf = new Map<string, CourseTpl>();
  const nVariants = Math.max(2, Math.ceil((cfg.groups * 1.6) / cfg.courses.length));
  cfg.courses.forEach((tpl, ti) => {
    for (let v = 0; v < nVariants; v++) {
      const per = tpl.blocks.reduce((s, n) => s + n, 0);
      const c: Course = {
        id: `c-${ti}-${v}`,
        code: `${tpl.prefix}${pad(v + 1)}`,
        name: `${tpl.name} ${v + 1}`,
        theory: tpl.type === "lecture" ? per : 1,
        practice: tpl.type === "lecture" ? 0 : per - 1,
        credits: Math.max(1, Math.round(per / 1.5)),
        periodsPerWeek: per,
        blockSizes: [...tpl.blocks],
        roomType: tpl.type,
        requiredEquipment: [...tpl.equipment],
        department: tpl.type === "lecture" ? "สามัญสัมพันธ์" : "วิชาชีพ",
      };
      courses.push(c);
      tplOf.set(c.id, tpl);
    }
  });
  const filler: Course = {
    id: "c-filler",
    code: `${FILLER.prefix}01`,
    name: FILLER.name,
    theory: 1,
    practice: 0,
    credits: 1,
    periodsPerWeek: 1,
    blockSizes: [1],
    roomType: "lecture",
    requiredEquipment: [],
    department: "สามัญสัมพันธ์",
  };
  if (cfg.fillHoles) courses.push(filler);

  // ---- teachers (ผูกตามประเภทห้อง)
  const types = [...new Set(cfg.courses.map((c) => c.type))];
  const demandShare = types.map((t) => cfg.courses.filter((c) => c.type === t).reduce((s, c) => s + c.blocks.reduce((a, b) => a + b, 0), 0));
  const totalShare = demandShare.reduce((a, b) => a + b, 0);
  const teachers: Teacher[] = [];
  for (let i = 0; i < cfg.teachers; i++) {
    // เลือกสาขาตามสัดส่วนความต้องการ
    let x = rng.next() * totalShare;
    let ti = 0;
    while (ti < types.length - 1 && x >= demandShare[ti]) x -= demandShare[ti++];
    if (i < types.length) ti = i; // อย่างน้อยสาขาละ 1 คน
    const type = types[ti];
    const pool = courses.filter((c) => c.roomType === type && c.id !== "c-filler").map((c) => c.id);
    rng.shuffle(pool);
    const q = pool.slice(0, Math.min(pool.length, cfg.coursesPerTeacher));
    if (cfg.fillHoles && (type === "lecture" || i % 3 === 0)) q.push(filler.id);
    teachers.push({
      id: `t${pad(i + 1, 3)}`,
      code: `T${pad(i + 1, 3)}`,
      prefix: i % 3 === 0 ? "นาย" : i % 3 === 1 ? "นางสาว" : "นาง",
      firstName: FIRST[i % FIRST.length],
      lastName: `${LAST[(i * 7) % LAST.length]}${i >= FIRST.length ? ` ${Math.floor(i / FIRST.length)}` : ""}`,
      position: i % 4 === 0 ? "ครูพิเศษ" : "ข้าราชการครู",
      department: type === "lecture" ? "สามัญสัมพันธ์" : "วิชาชีพ",
      qualifiedCourseIds: q,
      unavailable: [],
      preferredOff: [],
      maxPerDay: cfg.teacherCapDay,
      maxPerWeek: 40,
    });
  }

  // ---- groups
  const groups: StudentGroup[] = [];
  for (let i = 0; i < cfg.groups; i++) {
    const level = i % 2 === 0 ? "ปวส." : "ปวช.";
    groups.push({
      id: `g-${pad(i + 1)}`,
      code: `${level === "ปวส." ? "ส" : "ช"}IT.${(i % 3) + 1}/${Math.floor(i / 3) + 1}`,
      name: `${level} กลุ่ม ${i + 1}`,
      level,
      department: "เทคโนโลยีสารสนเทศ",
      size: cfg.groupSize[0] + rng.int(cfg.groupSize[1] - cfg.groupSize[0] + 1),
      advisorTeacherId: teachers[i % teachers.length].id,
    });
  }

  // ---- occupancy ของคำตอบที่ฝัง
  const gBusy = groups.map(() => new Uint8Array(S));
  const tBusy = teachers.map(() => new Uint8Array(S));
  const rBusy = rooms.map(() => new Uint8Array(S));
  const tDay = teachers.map(() => new Int32Array(D));
  const tIdx = new Map(teachers.map((t, i) => [t.id, i]));
  const gIdx = new Map(groups.map((g, i) => [g.id, i]));

  // ---- กิจกรรมล็อก
  const activities: LockedActivity[] = [];
  const hrDay = 2;
  const hrPeriod = P >= 8 ? P - 2 : P;
  groups.forEach((g, gi) => {
    const s = hrDay * P + hrPeriod - 1;
    const ti = tIdx.get(g.advisorTeacherId!)!;
    if (!gridOk(s) || tBusy[ti][s]) return;
    activities.push({ id: `act-hr-${g.id}`, code: "Home Room", name: "กิจกรรมโฮมรูม", day: hrDay, startPeriod: hrPeriod, length: 1, appliesToAll: false, teacherIds: [g.advisorTeacherId!], groupIds: [g.id], countsAsLoad: true });
    gBusy[gi][s] = 1;
    tBusy[ti][s] = 1;
  });
  // PLC ของครูสายวิชาชีพ (ไม่รวมครูที่ติดโฮมรูมในคาบนั้น)
  {
    const plcStart = Math.max(1, P - 1);
    const sA = hrDay * P + plcStart - 1;
    const ids = teachers
      .filter((t, i) => t.department === "วิชาชีพ" && i % 2 === 0)
      .filter((t) => {
        const i = tIdx.get(t.id)!;
        return !tBusy[i][sA] && !tBusy[i][sA + 1];
      })
      .map((t) => t.id);
    if (plcStart + 1 <= P && gridOk(sA) && gridOk(sA + 1)) {
      activities.push({ id: "act-plc", code: "PLC", name: "ชุมชนการเรียนรู้ทางวิชาชีพ", day: hrDay, startPeriod: plcStart, length: 2, appliesToAll: false, teacherIds: ids, groupIds: [], countsAsLoad: true });
      for (const id of ids) {
        tBusy[tIdx.get(id)!][sA] = 1;
        tBusy[tIdx.get(id)!][sA + 1] = 1;
      }
    }
  }
  if (cfg.allHands) {
    const s = 4 * P + 0; // ศุกร์ คาบ 1 ทุกคน
    activities.push({ id: "act-all", code: "ประชุมรวม", name: "กิจกรรมรวมทั้งวิทยาลัย", day: 4, startPeriod: 1, length: 1, appliesToAll: true, teacherIds: [], groupIds: [], countsAsLoad: false });
    gBusy.forEach((b) => (b[s] = 1));
    tBusy.forEach((b) => (b[s] = 1));
  }
  for (let gi = 0; gi < groups.length; gi++)
    for (let k = 0; k < cfg.extraLocksPerGroup; k++) {
      for (let tries = 0; tries < 50; tries++) {
        const s = rng.int(S);
        if (!gridOk(s) || gBusy[gi][s]) continue;
        activities.push({ id: `act-x-${groups[gi].id}-${k}`, code: "ชุมนุม", name: "กิจกรรมชุมนุม", day: Math.floor(s / P), startPeriod: (s % P) + 1, length: 1, appliesToAll: false, teacherIds: [], groupIds: [groups[gi].id], countsAsLoad: false });
        gBusy[gi][s] = 1;
        break;
      }
    }

  // ---- วางคาบ
  const assignments: Assignment[] = [];
  const solution: Placement[] = [];
  const groupLoad = new Int32Array(groups.length);
  const taken = groups.map(() => new Set<string>());

  const roomOkFor = (c: Course, size: number) =>
    rooms.map((r, i) => (r.capacity >= size && r.type === c.roomType && c.requiredEquipment.every((e) => r.equipment.includes(e)) ? i : -1)).filter((i) => i >= 0);

  /** พยายามวางทุก block ของวิชา c ให้กลุ่ม gis โดยครู ti — คืน placements หรือ null */
  const tryPlace = (c: Course, gis: number[], ti: number, aid: string): Placement[] | null => {
    const size = gis.reduce((s, gi) => s + groups[gi].size, 0);
    const cand = roomOkFor(c, size);
    if (!cand.length) return null;
    const placed: { s: number; r: number; len: number }[] = [];
    const usedDays = new Set<number>();
    const undo = () => {
      for (const p of placed)
        for (let k = 0; k < p.len; k++) {
          for (const gi of gis) gBusy[gi][p.s + k] = 0;
          tBusy[ti][p.s + k] = 0;
          rBusy[p.r][p.s + k] = 0;
        }
      for (const p of placed) tDay[ti][Math.floor(p.s / P)] -= p.len;
    };
    for (const len of c.blockSizes) {
      const opts: { s: number; r: number }[] = [];
      for (let d = 0; d < cfg.activeDays; d++) {
        if (usedDays.has(d) && rng.next() < 0.9) continue;
        if (tDay[ti][d] + len > cfg.teacherCapDay) continue;
        for (let p = 0; p + len <= P; p++) {
          const s0 = d * P + p;
          let ok = true;
          for (let k = 0; k < len && ok; k++) {
            const s = s0 + k;
            if (!gridOk(s) || tBusy[ti][s]) ok = false;
            for (const gi of gis) if (gBusy[gi][s]) ok = false;
          }
          if (!ok) continue;
          const freeRooms = cand.filter((r) => {
            for (let k = 0; k < len; k++) if (rBusy[r][s0 + k]) return false;
            return true;
          });
          if (freeRooms.length) opts.push({ s: s0, r: freeRooms[rng.int(freeRooms.length)] });
        }
      }
      if (!opts.length) {
        undo();
        return null;
      }
      // เอนเอียงไปคาบต้นวัน (ให้ตารางดูสมจริง)
      opts.sort((a, b) => (a.s % P) - (b.s % P) + (rng.next() - 0.5) * P * 1.2);
      const o = opts[0];
      for (let k = 0; k < len; k++) {
        for (const gi of gis) gBusy[gi][o.s + k] = 1;
        tBusy[ti][o.s + k] = 1;
        rBusy[o.r][o.s + k] = 1;
      }
      tDay[ti][Math.floor(o.s / P)] += len;
      usedDays.add(Math.floor(o.s / P));
      placed.push({ s: o.s, r: o.r, len });
    }
    return placed.map((p, bi) => ({ assignmentId: aid, block: bi, day: Math.floor(p.s / P), period: (p.s % P) + 1, roomId: rooms[p.r].id }));
  };

  let aSeq = 0;
  const commit = (c: Course, gis: number[], ti: number, extra: Partial<Assignment> = {}): boolean => {
    const aid = `a-${pad(aSeq + 1, 4)}`;
    const ps = tryPlace(c, gis, ti, aid);
    if (!ps) return false;
    aSeq++;
    assignments.push({ id: aid, courseId: c.id, teacherId: teachers[ti].id, groupIds: gis.map((gi) => groups[gi].id), ...extra });
    solution.push(...ps);
    const per = c.blockSizes.reduce((s, n) => s + n, 0);
    for (const gi of gis) {
      groupLoad[gi] += per;
      taken[gi].add(c.id);
    }
    return true;
  };
  const qualified = (cid: string) => teachers.map((t, i) => (t.qualifiedCourseIds.includes(cid) ? i : -1)).filter((i) => i >= 0);

  // วิชาเลือกร่วมหลายกลุ่ม (วางก่อนเพราะยากสุด) ใช้ห้องประชุมใหญ่
  for (let k = 0; k < cfg.shared.count; k++) {
    const gis = rng.shuffle([...Array(groups.length).keys()]).slice(0, Math.min(cfg.shared.groups, groups.length));
    const lect = courses.filter((c) => c.roomType === "lecture" && c.id !== "c-filler" && gis.every((gi) => !taken[gi].has(c.id)));
    const c = lect[rng.int(lect.length)];
    for (const ti of rng.shuffle(qualified(c.id))) if (commit(c, gis, ti)) break;
  }

  const freeSlots = groups.map((_, gi) => {
    let n = 0;
    for (let s = 0; s < S; s++) if (gridOk(s) && !gBusy[gi][s]) n++;
    return n + groupLoad[gi];
  });
  const target = freeSlots.map((n) => Math.floor(n * cfg.fill));
  const failed = groups.map(() => new Set<string>());
  let progress = true;
  while (progress) {
    progress = false;
    for (const gi of rng.shuffle([...Array(groups.length).keys()])) {
      const remaining = target[gi] - groupLoad[gi];
      if (remaining <= 0) continue;
      const opts = courses.filter((c) => c.id !== "c-filler" && !taken[gi].has(c.id) && !failed[gi].has(c.id) && c.periodsPerWeek <= remaining);
      if (!opts.length) continue;
      const c = opts[rng.int(opts.length)];
      let ok = false;
      for (const ti of rng.shuffle(qualified(c.id))) if ((ok = commit(c, [gi], ti))) break;
      if (!ok) failed[gi].add(c.id);
      progress = true;
    }
  }
  if (cfg.fillHoles) {
    // เติมช่องว่างด้วยคาบ 1 คาบ (วิชาแนะแนว) เพื่อให้ใช้ slot สูง
    for (let gi = 0; gi < groups.length; gi++) {
      let guard = 0;
      while (groupLoad[gi] < target[gi] && guard++ < 40) {
        let ok = false;
        // วิชาแนะแนวแต่ละกลุ่มใช้ assignment แยก (ครูอาจต่างกัน) — ใช้ blockSizes [1]
        for (const ti of rng.shuffle(qualified(filler.id))) if ((ok = commit(filler, [gi], ti))) break;
        if (!ok) break;
      }
    }
  }

  // ---- ปรับข้อมูลครู/ห้องให้สอดคล้องกับคำตอบ
  teachers.forEach((t, ti) => {
    let load = 0;
    for (const a of assignments) if (a.teacherId === t.id) load += courses.find((c) => c.id === a.courseId)!.periodsPerWeek;
    t.maxPerWeek = Math.max(1, load + cfg.weekSlack);
    const free: number[] = [];
    for (let s = 0; s < S; s++) if (gridOk(s) && !tBusy[ti][s]) free.push(s);
    rng.shuffle(free);
    t.unavailable = free.slice(0, cfg.unavailPerTeacher).map((s) => ({ day: Math.floor(s / P), period: (s % P) + 1 }));
    const grid: number[] = [];
    for (let s = 0; s < S; s++) if (gridOk(s)) grid.push(s);
    rng.shuffle(grid);
    t.preferredOff = grid.slice(0, cfg.prefPerTeacher).map((s) => ({ day: Math.floor(s / P), period: (s % P) + 1 }));
  });
  rooms.forEach((r, ri) => {
    if (rng.next() < 0.3) {
      const free: number[] = [];
      for (let s = 0; s < S; s++) if (gridOk(s) && !rBusy[ri][s]) free.push(s);
      if (free.length) {
        const s = free[rng.int(free.length)];
        r.unavailable = [{ day: Math.floor(s / P), period: (s % P) + 1 }];
      }
    }
  });

  // ---- นักเรียน (ข้อมูลขั้นต่ำ) + ลงทะเบียนข้ามกลุ่มที่ไม่ชนในคำตอบ
  const students: Student[] = [];
  groups.forEach((g, gi) => {
    for (let i = 0; i < g.size; i++)
      students.push({
        id: `s-${g.id.slice(2)}-${pad(i + 1)}`,
        code: `69${pad(gi + 1)}${pad(i + 1, 3)}`,
        displayName: `${FIRST[(gi * 5 + i) % FIRST.length]} ${LAST[(gi + i * 3) % LAST.length]}`,
        groupId: g.id,
        extraAssignmentIds: [],
      });
  });
  const solBy = new Map<string, Placement[]>();
  for (const p of solution) solBy.set(p.assignmentId, [...(solBy.get(p.assignmentId) ?? []), p]);
  const blocksLen = (a: Assignment) => courses.find((c) => c.id === a.courseId)!.blockSizes;
  let added = 0;
  for (let tries = 0; added < cfg.extraStudents && tries < cfg.extraStudents * 30; tries++) {
    const st = students[rng.int(students.length)];
    if (st.extraAssignmentIds.length) continue;
    const gi = gIdx.get(st.groupId)!;
    const a = assignments[rng.int(assignments.length)];
    if (a.groupIds.includes(st.groupId)) continue;
    const lens = blocksLen(a);
    let ok = true;
    for (const p of solBy.get(a.id) ?? [])
      for (let k = 0; k < lens[p.block]; k++) if (gBusy[gi][p.day * P + p.period - 1 + k]) ok = false;
    if (!ok) continue;
    st.extraAssignmentIds.push(a.id);
    // นักเรียนคนนี้ไม่ว่างในคาบเหล่านี้แล้ว — กันไม่ให้ลงวิชาอื่นทับ (แต่ละคนลงเพิ่มได้ 1 วิชา)
    added++;
  }
  void tplOf;

  const dataset: Dataset = {
    school: { id: `school-fx-${cfg.label}`, name: `วิทยาลัยตัวอย่าง ชุด${cfg.label} (สังเคราะห์)`, regularEndTime: "16:30", signatories: [{ name: "ผู้อำนวยการ (สังเคราะห์)", title: "ผู้อำนวยการ" }] },
    term: { id: "term-fx", year: "2569", term: "1", status: "setup" },
    time,
    courses,
    teachers,
    rooms,
    groups,
    students,
    assignments,
    activities,
  };
  return { dataset, solution };
}

// ---------------------------------------------------------------------------

function periodsOf(ds: Dataset, a: Assignment): number {
  if (a.blockSizes?.length) return a.blockSizes.reduce((s, n) => s + n, 0);
  return ds.courses.find((c) => c.id === a.courseId)?.periodsPerWeek ?? 0;
}

function teacherLoad(ds: Dataset, tid: string): number {
  return ds.assignments.filter((a) => a.teacherId === tid).reduce((s, a) => s + periodsOf(ds, a), 0);
}

function makeInfeasible(kind: FixtureKind, ds: Dataset, rng: Rng): Dataset {
  ds.school.name = `วิทยาลัยตัวอย่าง ชุด${kind} (สังเคราะห์)`;
  const P = ds.time.periods.length;
  const grid: { day: number; period: number }[] = [];
  ds.time.days.forEach((d) => {
    if (d.active) ds.time.periods.forEach((p) => !p.isBreak && grid.push({ day: d.index, period: p.no }));
  });
  switch (kind) {
    case "infeasible-p1": {
      // ครูที่ภาระมากสุด: ลด maxPerWeek ต่ำกว่าคาบที่ต้องสอน
      const t = [...ds.teachers].sort((a, b) => teacherLoad(ds, b.id) - teacherLoad(ds, a.id))[0];
      t.maxPerWeek = Math.max(0, teacherLoad(ds, t.id) - 2);
      break;
    }
    case "infeasible-p2": {
      // กลุ่มหนึ่งมีกิจกรรมล็อกเพิ่มจนเวลาที่ใช้ได้ < คาบที่ต้องเรียน
      const g = ds.groups[0];
      const req = ds.assignments.filter((a) => a.groupIds.includes(g.id)).reduce((s, a) => s + periodsOf(ds, a), 0);
      const locked = new Set<string>();
      for (const act of ds.activities)
        if (act.appliesToAll || act.groupIds.includes(g.id)) for (let k = 0; k < act.length; k++) locked.add(`${act.day}:${act.startPeriod + k}`);
      const free = grid.filter((x) => !locked.has(`${x.day}:${x.period}`));
      rng.shuffle(free);
      const need = free.length - req + 2;
      free.slice(0, need).forEach((x, i) =>
        ds.activities.push({ id: `act-p2-${i}`, code: "อบรม", name: "อบรมพิเศษของกลุ่ม", day: x.day, startPeriod: x.period, length: 1, appliesToAll: false, teacherIds: [], groupIds: [g.id], countsAsLoad: false }),
      );
      break;
    }
    case "infeasible-p3": {
      const a = ds.assignments[rng.int(ds.assignments.length)];
      const c = ds.courses.find((x) => x.id === a.courseId)!;
      c.requiredEquipment = [...c.requiredEquipment, "เครื่องพิมพ์สามมิติ"];
      break;
    }
    case "infeasible-p4": {
      // block ยาวกว่าช่วงคาบต่อเนื่องที่ไม่มีพักคั่น
      let run = 0;
      let best = 0;
      for (const p of ds.time.periods) {
        run = p.isBreak ? 0 : run + 1;
        best = Math.max(best, run);
      }
      const a = ds.assignments.find((x) => periodsOf(ds, x) >= 3) ?? ds.assignments[0];
      a.blockSizes = [best + 1];
      a.periodsPerWeek = best + 1;
      void P;
      break;
    }
    case "infeasible-p5": {
      // มอบหมายให้ครูที่ไม่มีคุณสมบัติ (เลือกครูภาระน้อยเพื่อไม่ให้เกิด P1)
      const a = ds.assignments.find((x) => !x.groupIds.some((g) => g === ds.groups[0].id)) ?? ds.assignments[0];
      const per = periodsOf(ds, a);
      const t = [...ds.teachers]
        .filter((x) => x.qualifiedCourseIds.length > 0 && !x.qualifiedCourseIds.includes(a.courseId) && x.id !== a.teacherId)
        .sort((x, y) => teacherLoad(ds, x.id) - teacherLoad(ds, y.id))[0];
      a.teacherId = t.id;
      t.maxPerWeek = Math.max(t.maxPerWeek, teacherLoad(ds, t.id) + per);
      break;
    }
    case "infeasible-p6": {
      // เหลือห้องคอมพิวเตอร์ห้องเดียว (มีอุปกรณ์ครบ) → pigeonhole
      const comps = ds.rooms.filter((r) => r.type === "computer");
      const keep = [...comps].sort((a, b) => b.capacity - a.capacity)[0];
      keep.equipment = [...new Set(comps.flatMap((r) => r.equipment))];
      keep.capacity = Math.max(...comps.map((r) => r.capacity), ...ds.groups.map((g) => g.size));
      keep.unavailable = [];
      for (const r of comps) if (r !== keep) {
        r.type = "lecture";
        r.equipment = ["โปรเจกเตอร์"];
      }
      break;
    }
    case "infeasible-p7": {
      // สามเหลี่ยมความขัดแย้ง: X(ครู A, กลุ่ม 1) Y(ครู A, กลุ่ม 2) Z(ครู B, กลุ่ม 1+2)
      // แต่ละคู่ ≤ slot ที่มี แต่รวม 3 วิชา > slot ที่มี
      const n = grid.length;
      const per = Math.floor(n / 3) + 2; // 3×per > n และ 2×per ≤ n
      const blocks: number[] = [];
      for (let left = per; left > 0; left -= 2) blocks.push(Math.min(2, left));
      ds.courses.push({ id: "c-p7", code: "30000-9901", name: "วิชาเสริมพิเศษ (สังเคราะห์)", theory: per, practice: 0, credits: 3, periodsPerWeek: per, blockSizes: blocks, roomType: "lecture", requiredEquipment: [] });
      ds.groups.push({ id: "g-p7a", code: "พิเศษ.1", name: "กลุ่มพิเศษ 1", level: "ปวส.", size: 20 }, { id: "g-p7b", code: "พิเศษ.2", name: "กลุ่มพิเศษ 2", level: "ปวส.", size: 20 });
      const mk = (id: string, code: string): Teacher => ({ id, code, prefix: "นาย", firstName: "ครูพิเศษ", lastName: code, position: "ครูพิเศษ", qualifiedCourseIds: [], unavailable: [], preferredOff: [], maxPerDay: P, maxPerWeek: 2 * per });
      ds.teachers.push(mk("t-p7a", "TP7A"), mk("t-p7b", "TP7B"));
      ds.rooms.push(
        { id: "r-p7-1", code: "P7-1", name: "ห้องพิเศษ 1", capacity: 60, type: "lecture", equipment: ["โปรเจกเตอร์"], unavailable: [] },
        { id: "r-p7-2", code: "P7-2", name: "ห้องพิเศษ 2", capacity: 60, type: "lecture", equipment: ["โปรเจกเตอร์"], unavailable: [] },
      );
      ds.assignments.push(
        { id: "a-p7x", courseId: "c-p7", teacherId: "t-p7a", groupIds: ["g-p7a"] },
        { id: "a-p7y", courseId: "c-p7", teacherId: "t-p7a", groupIds: ["g-p7b"] },
        { id: "a-p7z", courseId: "c-p7", teacherId: "t-p7b", groupIds: ["g-p7a", "g-p7b"] },
      );
      break;
    }
    default:
      break;
  }
  return ds;
}

/** เพิ่มโครงสร้าง C5 ที่จัดไม่ได้แต่ไม่มีหลักฐานแบบถูก (ดูคำอธิบายหัวไฟล์) */
function hardNoProof(ds: Dataset): Dataset {
  ds.school.name = "วิทยาลัยตัวอย่าง ชุดยากไม่มีหลักฐาน (สังเคราะห์)";
  const n = ds.time.days.filter((d) => d.active).length * ds.time.periods.filter((p) => !p.isBreak).length;
  // per: 2×per ≤ n (ทุกคู่ผ่าน P1/P2) แต่ 5×per > 2n (จัดไม่ได้)
  const per = Math.floor((2 * n) / 5) + 1;
  const blocks: number[] = [];
  for (let left = per; left > 0; left -= 2) blocks.push(Math.min(2, left));
  ds.courses.push({ id: "c-c5", code: "30000-9905", name: "วิชาบูรณาการ (สังเคราะห์)", theory: per, practice: 0, credits: 3, periodsPerWeek: per, blockSizes: blocks, roomType: "lecture", requiredEquipment: [] });
  const P = ds.time.periods.length;
  const gs = ["g-c5-12", "g-c5-34", "g-c5-40"];
  gs.forEach((id, i) => ds.groups.push({ id, code: `C5.${i + 1}`, name: `กลุ่มบูรณาการ ${i + 1}`, level: "ปวส.", size: 20 }));
  const mk = (id: string, code: string): Teacher => ({ id, code, prefix: "นาง", firstName: "ครูบูรณาการ", lastName: code, position: "ข้าราชการครู", qualifiedCourseIds: [], unavailable: [], preferredOff: [], maxPerDay: P, maxPerWeek: 2 * per });
  ds.teachers.push(mk("t-c5-01", "TC501"), mk("t-c5-23", "TC523"), mk("t-c5-4", "TC54"));
  for (let i = 1; i <= 3; i++) ds.rooms.push({ id: `r-c5-${i}`, code: `C5R${i}`, name: `ห้องบูรณาการ ${i}`, capacity: 80, type: "lecture", equipment: ["โปรเจกเตอร์"], unavailable: [] });
  // A0–A1 ครูร่วม, A1–A2 กลุ่มร่วม, A2–A3 ครูร่วม, A3–A4 กลุ่มร่วม, A4–A0 กลุ่มร่วม
  ds.assignments.push(
    { id: "a-c5-0", courseId: "c-c5", teacherId: "t-c5-01", groupIds: ["g-c5-40"] },
    { id: "a-c5-1", courseId: "c-c5", teacherId: "t-c5-01", groupIds: ["g-c5-12"] },
    { id: "a-c5-2", courseId: "c-c5", teacherId: "t-c5-23", groupIds: ["g-c5-12"] },
    { id: "a-c5-3", courseId: "c-c5", teacherId: "t-c5-23", groupIds: ["g-c5-34"] },
    { id: "a-c5-4", courseId: "c-c5", teacherId: "t-c5-4", groupIds: ["g-c5-34", "g-c5-40"] },
  );
  return ds;
}
