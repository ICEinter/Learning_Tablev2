/**
 * ตรวจและพรีวิวข้อมูลนำเข้า (ไม่เขียนข้อมูล)
 * - อ้างอิงด้วยรหัส แก้ค่าเป็น id จากชุดข้อมูลปัจจุบัน
 * - รหัสมีอยู่แล้ว → แก้ไข (คง id เดิม) / รหัสใหม่ → สร้าง (newId)
 * - ตรวจ: คอลัมน์จำเป็น, รูปแบบตัวเลข, รหัสซ้ำในไฟล์, ซ้ำกับฐานข้อมูล, อ้างอิงไม่พบ, Zod schema, ผลรวมคาบต่อเนื่อง
 */
import { newId } from "@/lib/id";
import { ENTITY_SCHEMAS } from "@/shared/schemas";
import { effectiveBlocks } from "@/shared/slots";
import type {
  Assignment,
  Course,
  Dataset,
  LockedActivity,
  Room,
  RoomType,
  SlotRef,
  Student,
  StudentGroup,
  Teacher,
} from "@/shared/types";
import { ROOM_TYPE_LABEL } from "@/shared/types";
import type { ParsedSheet } from "./parse";
import { normalizeDigits, parseDay, parseSlotList } from "./slots-format";
import type { ImportKind, ImportSpec } from "./specs";
import { IMPORT_SPECS } from "./specs";

export interface PreviewIssue {
  level: "error" | "warning";
  field?: string;
  message: string;
}

export interface PreviewRow {
  rowNumber: number /* 1-based sheet row incl. header => first data row = 2 */;
  action: "create" | "update" | "error";
  entity?: unknown;
  issues: PreviewIssue[];
  raw: Record<string, string>;
}

export interface ImportPreview {
  kind: ImportKind;
  rows: PreviewRow[];
  summary: { total: number; create: number; update: number; error: number; warning: number };
}

const ID_PREFIX: Record<ImportKind, string> = {
  courses: "c",
  teachers: "t",
  rooms: "r",
  groups: "g",
  students: "s",
  assignments: "a",
  activities: "act",
};

/** ชื่อฟิลด์ใน entity -> key คอลัมน์ในไฟล์ (สำหรับแปลง path ของ Zod) */
const FIELD_TO_COLUMN: Record<string, string> = {
  qualifiedCourseIds: "qualifiedCourses",
  groupId: "groupCode",
  extraAssignmentIds: "extraAssignments",
  courseId: "courseCode",
  teacherId: "teacherCode",
  groupIds: "groupCodes",
  fixedRoomId: "fixedRoomCode",
  teacherIds: "teacherCodes",
  roomId: "roomCode",
  advisorTeacherId: "advisorTeacherCode",
};

const key = (s: string | undefined | null) => (s ?? "").trim().toUpperCase();

// ---------------------------------------------------------------------------
// value parsers
// ---------------------------------------------------------------------------

const TRUE_WORDS = new Set(["ใช่", "true", "1", "yes", "y", "x", "✓", "มี", "จริง"]);
const FALSE_WORDS = new Set(["ไม่ใช่", "false", "0", "no", "n", "ไม่", "ไม่มี", "เท็จ", "-"]);

export function parseBool(s: string): boolean | null {
  const v = s.trim().toLowerCase();
  if (TRUE_WORDS.has(v)) return true;
  if (FALSE_WORDS.has(v)) return false;
  return null;
}

export function splitList(s: string): string[] {
  return (s ?? "")
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const ROOM_TYPE_ALIASES: [string, RoomType][] = [
  ["บรรยาย", "lecture"],
  ["คอมพิวเตอร์", "computer"],
  ["วิทยาศาสตร์", "lab"],
  ["โรงฝึก", "workshop"],
  ["ภาษา", "language"],
  ["กิจกรรม", "activity"],
  ["สถานประกอบการ", "external"],
  ["ภายนอก", "external"],
];

export function parseRoomType(s: string): RoomType | null {
  const v = s.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  const keys = Object.keys(ROOM_TYPE_LABEL) as RoomType[];
  const byKey = keys.find((k) => k === lower);
  if (byKey) return byKey;
  const byLabel = keys.find((k) => ROOM_TYPE_LABEL[k] === v);
  if (byLabel) return byLabel;
  const alias = ROOM_TYPE_ALIASES.find(([w]) => v.includes(w));
  return alias ? alias[1] : null;
}

/** แบ่งคาบอัตโนมัติ: ช่วงละ 2 คาบ ถ้าเป็นเลขคี่มีช่วง 1 คาบนำหน้า (5 → 1+2+2) */
export function defaultBlocks(periods: number): number[] {
  if (periods <= 0) return [];
  const out: number[] = periods % 2 === 1 ? [1] : [];
  for (let i = 0; i < Math.floor(periods / 2); i++) out.push(2);
  return out;
}

// ---------------------------------------------------------------------------
// row context
// ---------------------------------------------------------------------------

interface Ctx {
  ds: Dataset;
  spec: ImportSpec;
  P: number;
  course: Map<string, Course>;
  teacher: Map<string, Teacher>;
  room: Map<string, Room>;
  group: Map<string, StudentGroup>;
  student: Map<string, Student>;
  courseById: Map<string, Course>;
  groupById: Map<string, StudentGroup>;
  assignmentById: Map<string, Assignment>;
}

class Row {
  issues: PreviewIssue[] = [];
  constructor(
    readonly raw: Record<string, string>,
    readonly mapped: Set<string>,
    readonly spec: ImportSpec,
  ) {}

  has(k: string): boolean {
    return this.mapped.has(k);
  }

  header(k: string): string {
    return this.spec.columns.find((c) => c.key === k)?.header ?? k;
  }

  str(k: string): string {
    return (this.raw[k] ?? "").trim();
  }

  err(field: string | undefined, message: string) {
    this.issues.push({ level: "error", field, message });
  }

  warn(field: string | undefined, message: string) {
    this.issues.push({ level: "warning", field, message });
  }

  fieldHasError(field: string): boolean {
    return this.issues.some((i) => i.level === "error" && i.field === field);
  }

  required(k: string): string {
    const v = this.str(k);
    if (!v) this.err(k, this.has(k) ? `ต้องระบุ "${this.header(k)}"` : `ไม่พบคอลัมน์ "${this.header(k)}" ในไฟล์`);
    return v;
  }

  /** จำนวนเต็ม; ว่าง → undefined (ถ้า required จะแจ้ง error) */
  int(k: string, required = false): number | undefined {
    const v = normalizeDigits(this.str(k)).replace(/,/g, "");
    if (!v) {
      if (required) this.required(k);
      return undefined;
    }
    if (!/^[-+]?\d+(\.0+)?$/.test(v)) {
      this.err(
        k,
        /^[-+]?\d*\.\d+$/.test(v)
          ? `"${this.header(k)}" ต้องเป็นจำนวนเต็ม (พบ "${this.str(k)}")`
          : `"${this.header(k)}" ต้องเป็นตัวเลข (พบ "${this.str(k)}")`,
      );
      return undefined;
    }
    return Math.trunc(Number(v));
  }

  bool(k: string, dflt: boolean): boolean {
    const v = this.str(k);
    if (!v) return dflt;
    const b = parseBool(v);
    if (b === null) {
      this.err(k, `"${this.header(k)}" ต้องเป็น ใช่/ไม่ใช่ (พบ "${v}")`);
      return dflt;
    }
    return b;
  }

  list(k: string): string[] {
    return splitList(this.str(k));
  }

  intList(k: string): number[] | undefined {
    const v = normalizeDigits(this.str(k));
    if (!v) return undefined;
    const parts = v.split(/[+,;\s]+/).filter(Boolean);
    if (parts.some((p) => !/^\d+$/.test(p))) {
      this.err(k, `"${this.header(k)}" ต้องเป็นตัวเลขคั่นด้วย + เช่น 1+2+2 (พบ "${this.str(k)}")`);
      return undefined;
    }
    return parts.map(Number);
  }

  slots(k: string, P: number): SlotRef[] {
    const r = parseSlotList(this.str(k), { maxPeriod: P });
    r.errors.forEach((e) => this.err(k, `${this.header(k)}: ${e}`));
    return r.slots;
  }

  /** แก้รหัสเป็น entity; ไม่พบ → error */
  ref<T>(k: string, code: string, map: Map<string, T>, label: string): T | undefined {
    const x = map.get(key(code));
    if (!x) this.err(k, `ไม่พบ${label}รหัส "${code}" ในระบบ`);
    return x;
  }
}

/** ค่าเดิม (เมื่อแก้ไขและไม่มีคอลัมน์นั้นในไฟล์) หรือค่าใหม่ */
function keepOr<T>(row: Row, k: string, existing: T | undefined, next: () => T): T {
  if (!row.has(k) && existing !== undefined) return existing;
  return next();
}

function optStr(row: Row, k: string, existing: string | undefined): string | undefined {
  return keepOr(row, k, existing, () => row.str(k) || undefined);
}

interface Built {
  /** คีย์สำหรับตรวจซ้ำในไฟล์ / จับคู่กับฐานข้อมูล */
  matchKey: string;
  /** ข้อความแสดงคีย์ (สำหรับข้อความซ้ำ) */
  keyLabel: string;
  existing?: { id: string };
  entity: Record<string, unknown>;
}

type Builder = (row: Row, ctx: Ctx) => Built | null;

// ---------------------------------------------------------------------------
// builders per kind
// ---------------------------------------------------------------------------

const buildCourse: Builder = (row, ctx) => {
  const code = row.required("code");
  if (!code) return null;
  const ex = ctx.course.get(key(code));
  const name = keepOr(row, "name", ex?.name, () => row.required("name"));
  const theory = keepOr(row, "theory", ex?.theory, () => row.int("theory", true) ?? 0);
  const practice = keepOr(row, "practice", ex?.practice, () => row.int("practice", true) ?? 0);
  const credits = keepOr(row, "credits", ex?.credits, () => row.int("credits", true) ?? 0);
  const ppwRaw = row.has("periodsPerWeek") ? row.int("periodsPerWeek") : undefined;
  const periodsPerWeek =
    ppwRaw ?? (!row.has("periodsPerWeek") && ex && !row.has("theory") && !row.has("practice") ? ex.periodsPerWeek : theory + practice);
  let blockSizes = row.has("blockSizes") ? row.intList("blockSizes") : undefined;
  if (!blockSizes) {
    if (!row.has("blockSizes") && ex && ex.blockSizes.reduce((s, n) => s + n, 0) === periodsPerWeek) blockSizes = ex.blockSizes;
    else if (!row.fieldHasError("blockSizes")) {
      blockSizes = defaultBlocks(periodsPerWeek);
      if (periodsPerWeek > 0 && (!ex || row.has("blockSizes")))
        row.warn("blockSizes", `ไม่ได้ระบุการแบ่งคาบต่อเนื่อง ใช้ค่าอัตโนมัติ ${blockSizes.join("+")}`);
    } else blockSizes = [];
  } else {
    const sum = blockSizes.reduce((s, n) => s + n, 0);
    if (sum !== periodsPerWeek)
      row.err("blockSizes", `ผลรวมการแบ่งคาบต่อเนื่อง (${blockSizes.join("+")} = ${sum}) ไม่เท่ากับคาบต่อสัปดาห์ (${periodsPerWeek})`);
  }
  if (ppwRaw !== undefined && ppwRaw !== theory + practice)
    row.warn("periodsPerWeek", `คาบต่อสัปดาห์ (${ppwRaw}) ไม่เท่ากับ ท.+ป. (${theory + practice})`);
  const roomType = keepOr<RoomType | undefined>(row, "roomType", ex?.roomType, () => {
    const v = row.required("roomType");
    if (!v) return undefined;
    const t = parseRoomType(v);
    if (!t) row.err("roomType", `ไม่รู้จักประเภทห้อง "${v}"`);
    return t ?? undefined;
  });
  const entity: Course = {
    id: "",
    code,
    name,
    theory,
    practice,
    credits,
    periodsPerWeek,
    blockSizes,
    roomType: (roomType ?? "lecture") as RoomType,
    requiredEquipment: keepOr(row, "requiredEquipment", ex?.requiredEquipment, () => row.list("requiredEquipment")),
    department: optStr(row, "department", ex?.department),
    isActivity: keepOr(row, "isActivity", ex?.isActivity, () => row.bool("isActivity", false)),
  };
  return { matchKey: key(code), keyLabel: code, existing: ex, entity: entity as unknown as Record<string, unknown> };
};

const buildTeacher: Builder = (row, ctx) => {
  const code = row.required("code");
  if (!code) return null;
  const ex = ctx.teacher.get(key(code));
  const qualified = keepOr(row, "qualifiedCourses", ex?.qualifiedCourseIds, () =>
    row
      .list("qualifiedCourses")
      .map((c) => row.ref("qualifiedCourses", c, ctx.course, "รายวิชา")?.id)
      .filter((x): x is string => Boolean(x)),
  );
  const maxPerDay = keepOr(row, "maxPerDay", ex?.maxPerDay, () => row.int("maxPerDay") ?? 8);
  const maxPerWeek = keepOr(row, "maxPerWeek", ex?.maxPerWeek, () => row.int("maxPerWeek") ?? 30);
  const entity: Teacher = {
    id: "",
    code,
    prefix: keepOr(row, "prefix", ex?.prefix, () => row.required("prefix")),
    firstName: keepOr(row, "firstName", ex?.firstName, () => row.required("firstName")),
    lastName: keepOr(row, "lastName", ex?.lastName, () => row.required("lastName")),
    position: keepOr(row, "position", ex?.position, () => row.required("position")),
    degree: optStr(row, "degree", ex?.degree),
    department: optStr(row, "department", ex?.department),
    specialDuty: optStr(row, "specialDuty", ex?.specialDuty),
    qualifiedCourseIds: qualified,
    unavailable: keepOr(row, "unavailable", ex?.unavailable, () => row.slots("unavailable", ctx.P)),
    preferredOff: keepOr(row, "preferredOff", ex?.preferredOff, () => row.slots("preferredOff", ctx.P)),
    maxPerDay,
    maxPerWeek,
    email: optStr(row, "email", ex?.email),
  };
  return { matchKey: key(code), keyLabel: code, existing: ex, entity: entity as unknown as Record<string, unknown> };
};

const buildRoom: Builder = (row, ctx) => {
  const code = row.required("code");
  if (!code) return null;
  const ex = ctx.room.get(key(code));
  const type = keepOr<RoomType | undefined>(row, "type", ex?.type, () => {
    const v = row.required("type");
    if (!v) return undefined;
    const t = parseRoomType(v);
    if (!t) row.err("type", `ไม่รู้จักประเภทห้อง "${v}"`);
    return t ?? undefined;
  });
  const entity: Room = {
    id: "",
    code,
    name: keepOr(row, "name", ex?.name, () => row.required("name")),
    capacity: keepOr(row, "capacity", ex?.capacity, () => row.int("capacity", true) ?? 0),
    type: (type ?? "lecture") as RoomType,
    equipment: keepOr(row, "equipment", ex?.equipment, () => row.list("equipment")),
    unavailable: keepOr(row, "unavailable", ex?.unavailable, () => row.slots("unavailable", ctx.P)),
  };
  return { matchKey: key(code), keyLabel: code, existing: ex, entity: entity as unknown as Record<string, unknown> };
};

const buildGroup: Builder = (row, ctx) => {
  const code = row.required("code");
  if (!code) return null;
  const ex = ctx.group.get(key(code));
  const advisor = keepOr(row, "advisorTeacherCode", ex?.advisorTeacherId, () => {
    const c = row.str("advisorTeacherCode");
    return c ? row.ref("advisorTeacherCode", c, ctx.teacher, "ครู")?.id : undefined;
  });
  const entity: StudentGroup = {
    id: "",
    code,
    name: keepOr(row, "name", ex?.name, () => row.required("name")),
    level: keepOr(row, "level", ex?.level, () => row.required("level")),
    department: optStr(row, "department", ex?.department),
    size: keepOr(row, "size", ex?.size, () => row.int("size", true) ?? 0),
    advisorTeacherId: advisor,
    note: optStr(row, "note", ex?.note),
  };
  return { matchKey: key(code), keyLabel: code, existing: ex, entity: entity as unknown as Record<string, unknown> };
};

/** แก้ "รหัสวิชา@รหัสกลุ่ม" หรือ id เป็นรายการมอบหมายสอน */
function resolveAssignmentRef(row: Row, k: string, ref: string, ctx: Ctx): string | undefined {
  if (ctx.assignmentById.has(ref)) return ref;
  const at = ref.indexOf("@");
  if (at < 0) {
    row.err(k, `อ้างอิงรายการสอน "${ref}" ไม่ถูกต้อง (ใช้รูปแบบ รหัสวิชา@รหัสกลุ่ม)`);
    return undefined;
  }
  const c = row.ref(k, ref.slice(0, at).trim(), ctx.course, "รายวิชา");
  const g = row.ref(k, ref.slice(at + 1).trim(), ctx.group, "กลุ่มเรียน");
  if (!c || !g) return undefined;
  const found = ctx.ds.assignments.filter((a) => a.courseId === c.id && a.groupIds.includes(g.id));
  if (found.length === 0) {
    row.err(k, `ไม่พบรายการมอบหมายสอนวิชา ${c.code} ของกลุ่ม ${g.code}`);
    return undefined;
  }
  if (found.length > 1) row.warn(k, `วิชา ${c.code} กลุ่ม ${g.code} มีหลายรายการสอน ใช้รายการแรก (${found[0].id})`);
  return found[0].id;
}

const buildStudent: Builder = (row, ctx) => {
  const code = row.required("code");
  if (!code) return null;
  const ex = ctx.student.get(key(code));
  const groupId = keepOr<string | undefined>(row, "groupCode", ex?.groupId, () => {
    const c = row.required("groupCode");
    return c ? row.ref("groupCode", c, ctx.group, "กลุ่มเรียน")?.id : undefined;
  });
  const extra = keepOr(row, "extraAssignments", ex?.extraAssignmentIds, () =>
    row
      .list("extraAssignments")
      .map((r) => resolveAssignmentRef(row, "extraAssignments", r, ctx))
      .filter((x): x is string => Boolean(x)),
  );
  const entity: Student = {
    id: "",
    code,
    displayName: keepOr(row, "displayName", ex?.displayName, () => row.required("displayName")),
    groupId: groupId ?? "",
    extraAssignmentIds: [...new Set(extra)],
  };
  return { matchKey: key(code), keyLabel: code, existing: ex, entity: entity as unknown as Record<string, unknown> };
};

const buildAssignment: Builder = (row, ctx) => {
  const idCol = row.str("id");
  const byId = idCol ? ctx.assignmentById.get(idCol) : undefined;
  if (idCol && !byId) row.err("id", `ไม่พบรายการมอบหมายสอน id "${idCol}"`);
  const cCode = byId && !row.str("courseCode") ? undefined : row.required("courseCode");
  const course = cCode ? row.ref("courseCode", cCode, ctx.course, "รายวิชา") : byId ? ctx.courseById.get(byId.courseId) : undefined;
  const tCode = byId && !row.str("teacherCode") ? undefined : row.required("teacherCode");
  const teacher = tCode ? row.ref("teacherCode", tCode, ctx.teacher, "ครู") : undefined;
  const gCodes = byId && !row.str("groupCodes") ? [] : row.list("groupCodes");
  if (!byId && gCodes.length === 0 && row.str("groupCodes") === "") row.required("groupCodes");
  const groups = gCodes.map((g) => row.ref("groupCodes", g, ctx.group, "กลุ่มเรียน")).filter((x): x is StudentGroup => Boolean(x));
  const groupIds = groups.length ? [...new Set(groups.map((g) => g.id))] : (byId?.groupIds ?? []);
  if (!course || (!teacher && !byId) || (groupIds.length === 0 && !byId)) {
    if (!row.issues.some((i) => i.level === "error")) row.err(undefined, "ข้อมูลไม่ครบ");
    return null;
  }
  const sortedGroups = [...groupIds].sort();
  const ex =
    byId ?? ctx.ds.assignments.find((a) => a.courseId === course.id && [...a.groupIds].sort().join("|") === sortedGroups.join("|"));
  const ppw = keepOr(row, "periodsPerWeek", ex?.periodsPerWeek, () => row.int("periodsPerWeek"));
  const blocks = keepOr(row, "blockSizes", ex?.blockSizes, () => row.intList("blockSizes"));
  if (blocks && ppw !== undefined) {
    const sum = blocks.reduce((s, n) => s + n, 0);
    if (sum !== ppw) row.err("blockSizes", `ผลรวมการแบ่งคาบต่อเนื่อง (${blocks.join("+")} = ${sum}) ไม่เท่ากับคาบต่อสัปดาห์ (${ppw})`);
  }
  const fixedRoomId = keepOr(row, "fixedRoomCode", ex?.fixedRoomId, () => {
    const c = row.str("fixedRoomCode");
    return c ? row.ref("fixedRoomCode", c, ctx.room, "ห้อง")?.id : undefined;
  });
  const teacherId = teacher?.id ?? ex?.teacherId ?? "";
  const tch = teacher ?? ctx.ds.teachers.find((t) => t.id === teacherId);
  if (tch && tch.qualifiedCourseIds.length > 0 && !tch.qualifiedCourseIds.includes(course.id))
    row.warn("teacherCode", `ครู ${tch.code} ไม่มีวิชา ${course.code} ในรายวิชาที่สอนได้`);
  const entity: Assignment = {
    id: "",
    courseId: course.id,
    teacherId,
    groupIds,
    ...(ppw !== undefined ? { periodsPerWeek: ppw } : {}),
    ...(blocks ? { blockSizes: blocks } : {}),
    ...(fixedRoomId ? { fixedRoomId } : {}),
  };
  if (!blocks && ppw !== undefined && ppw !== course.periodsPerWeek)
    row.warn("periodsPerWeek", `คาบต่อสัปดาห์ต่างจากรายวิชา จะแบ่งเป็น ${effectiveBlocks(entity, course).join("+")}`);
  const groupLabel = groupIds.map((g) => ctx.groupById.get(g)?.code ?? g).join(",");
  return {
    matchKey: byId ? `ID:${byId.id}` : `${course.id}@${sortedGroups.join("|")}`,
    keyLabel: `${course.code}@${groupLabel}`,
    existing: ex,
    entity: entity as unknown as Record<string, unknown>,
  };
};

const buildActivity: Builder = (row, ctx) => {
  const idCol = row.str("id");
  const byId = idCol ? ctx.ds.activities.find((a) => a.id === idCol) : undefined;
  if (idCol && !byId) row.err("id", `ไม่พบกิจกรรม id "${idCol}"`);
  const code = keepOr(row, "code", byId?.code, () => row.required("code"));
  const name = keepOr(row, "name", byId?.name, () => row.required("name"));
  const day = keepOr<number | undefined>(row, "day", byId?.day, () => {
    const v = row.required("day");
    if (!v) return undefined;
    const d = parseDay(v);
    if (d === null) row.err("day", `ไม่รู้จักวัน "${v}" (ใช้ จ. อ. พ. พฤ. ศ. ส. อา.)`);
    return d ?? undefined;
  });
  const startPeriod = keepOr(row, "startPeriod", byId?.startPeriod, () => row.int("startPeriod", true));
  const length = keepOr(row, "length", byId?.length, () => row.int("length", true));
  if (startPeriod !== undefined && length !== undefined && startPeriod + length - 1 > ctx.P)
    row.err("length", `คาบ ${startPeriod}+${length} คาบ เกินจำนวนคาบต่อวัน (${ctx.P})`);
  if (day !== undefined && !ctx.ds.time.days.find((d) => d.index === day)?.active)
    row.warn("day", "วันที่ระบุถูกปิดไว้ในโครงสร้างเวลา");
  const appliesToAll = keepOr(row, "appliesToAll", byId?.appliesToAll, () => row.bool("appliesToAll", false));
  const teacherIds = keepOr(row, "teacherCodes", byId?.teacherIds, () =>
    row
      .list("teacherCodes")
      .map((c) => row.ref("teacherCodes", c, ctx.teacher, "ครู")?.id)
      .filter((x): x is string => Boolean(x)),
  );
  const groupIds = keepOr(row, "groupCodes", byId?.groupIds, () =>
    row
      .list("groupCodes")
      .map((c) => row.ref("groupCodes", c, ctx.group, "กลุ่มเรียน")?.id)
      .filter((x): x is string => Boolean(x)),
  );
  const roomId = keepOr(row, "roomCode", byId?.roomId, () => {
    const c = row.str("roomCode");
    return c ? row.ref("roomCode", c, ctx.room, "ห้อง")?.id : undefined;
  });
  if (!code || day === undefined || startPeriod === undefined) return null;
  const who = groupIds.length ? [...groupIds].sort().join("|") : appliesToAll ? "ALL" : [...teacherIds].sort().join("|");
  const matchKey = byId ? `ID:${byId.id}` : `${key(code)}|${day}|${startPeriod}|${who}`;
  const ex =
    byId ??
    ctx.ds.activities.find((a) => {
      const w = a.groupIds.length ? [...a.groupIds].sort().join("|") : a.appliesToAll ? "ALL" : [...a.teacherIds].sort().join("|");
      return `${key(a.code)}|${a.day}|${a.startPeriod}|${w}` === matchKey;
    });
  const entity: LockedActivity = {
    id: "",
    code,
    name,
    day,
    startPeriod,
    length: length ?? 1,
    appliesToAll,
    teacherIds,
    groupIds,
    ...(roomId ? { roomId } : {}),
    countsAsLoad: keepOr(row, "countsAsLoad", byId?.countsAsLoad, () => row.bool("countsAsLoad", true)),
  };
  const dayShort = ctx.ds.time.days.find((d) => d.index === day)?.short ?? String(day);
  return { matchKey, keyLabel: `${code} ${dayShort}${startPeriod}`, existing: ex, entity: entity as unknown as Record<string, unknown> };
};

const BUILDERS: Record<ImportKind, Builder> = {
  courses: buildCourse,
  teachers: buildTeacher,
  rooms: buildRoom,
  groups: buildGroup,
  students: buildStudent,
  assignments: buildAssignment,
  activities: buildActivity,
};

function makeCtx(ds: Dataset, spec: ImportSpec): Ctx {
  const byCode = <T extends { code: string }>(xs: T[]) => new Map(xs.map((x) => [key(x.code), x]));
  return {
    ds,
    spec,
    P: ds.time.periods.length,
    course: byCode(ds.courses),
    teacher: byCode(ds.teachers),
    room: byCode(ds.rooms),
    group: byCode(ds.groups),
    student: byCode(ds.students),
    courseById: new Map(ds.courses.map((x) => [x.id, x])),
    groupById: new Map(ds.groups.map((x) => [x.id, x])),
    assignmentById: new Map(ds.assignments.map((x) => [x.id, x])),
  };
}

/** ลบค่า undefined ออกจาก object (ให้ตรงกับ optional field และเก็บลง Firestore ได้) */
function stripUndefined<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}

export function buildImportPreview(
  kind: ImportKind,
  sheet: ParsedSheet,
  mapping: Record<string, number | null>,
  ds: Dataset,
): ImportPreview {
  const spec = IMPORT_SPECS[kind];
  const ctx = makeCtx(ds, spec);
  const schema = ENTITY_SCHEMAS[kind];
  const mapped = new Set(
    spec.columns.filter((c) => mapping[c.key] !== null && mapping[c.key] !== undefined).map((c) => c.key),
  );
  const seen = new Map<string, number>();
  const rows: PreviewRow[] = sheet.rows.map((cells, i) => {
    const rowNumber = sheet.rowNumbers?.[i] ?? i + 2;
    const raw: Record<string, string> = {};
    for (const c of spec.columns) {
      const idx = mapping[c.key];
      raw[c.key] = idx === null || idx === undefined ? "" : (cells[idx] ?? "").trim();
    }
    const row = new Row(raw, mapped, spec);
    const built = BUILDERS[kind](row, ctx);
    let entity: Record<string, unknown> | undefined;
    let action: PreviewRow["action"] = "create";
    if (built) {
      const first = seen.get(built.matchKey);
      if (first !== undefined) {
        row.err(kind === "assignments" || kind === "activities" ? undefined : "code", `ข้อมูลซ้ำในไฟล์ (${built.keyLabel}) กับแถวที่ ${first}`);
      } else seen.set(built.matchKey, rowNumber);
      if (built.existing) {
        action = "update";
        row.warn(undefined, `มี "${built.keyLabel}" อยู่ในระบบแล้ว — จะแก้ไขข้อมูลเดิม`);
      }
      entity = stripUndefined({ ...built.entity, id: built.existing?.id ?? newId(ID_PREFIX[kind]) });
      const parsed = schema.safeParse(entity);
      if (!parsed.success) {
        for (const iss of parsed.error.issues) {
          const f = String(iss.path[0] ?? "");
          const field = FIELD_TO_COLUMN[f] ?? (f || undefined);
          if (field && row.fieldHasError(field)) continue;
          const header = field ? (spec.columns.find((c) => c.key === field)?.header ?? field) : "";
          row.err(field, header ? `${header}: ${iss.message}` : iss.message);
        }
      }
    }
    const hasError = !built || row.issues.some((x) => x.level === "error");
    if (hasError) action = "error";
    return { rowNumber, action, entity: hasError ? undefined : entity, issues: row.issues, raw };
  });
  const summary = {
    total: rows.length,
    create: rows.filter((r) => r.action === "create").length,
    update: rows.filter((r) => r.action === "update").length,
    error: rows.filter((r) => r.action === "error").length,
    warning: rows.filter((r) => r.issues.some((x) => x.level === "warning")).length,
  };
  return { kind, rows, summary };
}

/** เฉพาะแถวที่สร้าง/แก้ไขได้ พร้อมส่งให้ repository upsert */
export function itemsToCommit(preview: ImportPreview): unknown[] {
  return preview.rows.filter((r) => r.action !== "error" && r.entity !== undefined).map((r) => r.entity);
}
