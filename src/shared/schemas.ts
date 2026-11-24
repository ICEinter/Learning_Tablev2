/**
 * Zod schemas — ใช้ร่วมกันทั้งฟอร์ม (client), การนำเข้า และ API (server)
 */
import { z } from "zod";

const HHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาต้องเป็น HH:mm");
export const CodeSchema = z
  .string()
  .trim()
  .min(1, "ต้องระบุรหัส")
  .max(32, "รหัสยาวเกิน 32 ตัวอักษร");
const Name = z.string().trim().min(1, "ต้องระบุชื่อ").max(120, "ชื่อยาวเกิน 120 ตัวอักษร");
const Id = z.string().min(1);
const PosInt = (label: string) => z.number({ error: `${label}ต้องเป็นตัวเลข` }).int(`${label}ต้องเป็นจำนวนเต็ม`);

export const SlotRefSchema = z.object({
  day: z.number().int().min(0).max(6),
  period: z.number().int().min(1).max(30),
});

export const RoomTypeSchema = z.enum(["lecture", "computer", "lab", "workshop", "language", "activity", "external"]);

export const CourseSchema = z
  .object({
    id: Id,
    code: CodeSchema,
    name: Name,
    theory: PosInt("ท.").min(0).max(20),
    practice: PosInt("ป.").min(0).max(40),
    credits: PosInt("หน่วยกิต").min(0).max(20),
    periodsPerWeek: PosInt("คาบต่อสัปดาห์").min(1, "คาบต่อสัปดาห์ต้องมากกว่า 0").max(40),
    blockSizes: z.array(PosInt("คาบต่อเนื่อง").min(1).max(8)).min(1, "ต้องมีอย่างน้อย 1 ช่วง"),
    roomType: RoomTypeSchema,
    requiredEquipment: z.array(z.string().trim().min(1)).max(20),
    department: z.string().optional(),
    isActivity: z.boolean().optional(),
  })
  .refine((c) => c.blockSizes.reduce((s, n) => s + n, 0) === c.periodsPerWeek, {
    path: ["blockSizes"],
    message: "ผลรวมคาบต่อเนื่องต้องเท่ากับจำนวนคาบต่อสัปดาห์",
  });

export const TeacherSchema = z
  .object({
    id: Id,
    code: CodeSchema,
    prefix: z.string().trim().min(1, "ต้องระบุคำนำหน้า"),
    firstName: Name,
    lastName: Name,
    position: z.string().trim().min(1, "ต้องระบุตำแหน่ง"),
    degree: z.string().optional(),
    department: z.string().optional(),
    specialDuty: z.string().optional(),
    qualifiedCourseIds: z.array(Id),
    unavailable: z.array(SlotRefSchema),
    preferredOff: z.array(SlotRefSchema),
    maxPerDay: PosInt("ภาระสูงสุดต่อวัน").min(1).max(20),
    maxPerWeek: PosInt("ภาระสูงสุดต่อสัปดาห์").min(1).max(80),
    email: z.union([z.literal(""), z.email("อีเมลไม่ถูกต้อง")]).optional(),
  })
  .refine((t) => t.maxPerDay <= t.maxPerWeek, { path: ["maxPerDay"], message: "ภาระต่อวันต้องไม่เกินภาระต่อสัปดาห์" });

export const RoomSchema = z.object({
  id: Id,
  code: CodeSchema,
  name: Name,
  capacity: PosInt("ความจุ").min(1, "ความจุต้องมากกว่า 0").max(10000),
  type: RoomTypeSchema,
  equipment: z.array(z.string().trim().min(1)).max(30),
  unavailable: z.array(SlotRefSchema),
});

export const GroupSchema = z.object({
  id: Id,
  code: CodeSchema,
  name: Name,
  level: z.string().trim().min(1, "ต้องระบุระดับชั้น"),
  department: z.string().optional(),
  size: PosInt("จำนวนผู้เรียน").min(1, "จำนวนผู้เรียนต้องมากกว่า 0").max(500),
  advisorTeacherId: z.string().optional(),
  note: z.string().optional(),
});

export const StudentSchema = z.object({
  id: Id,
  code: CodeSchema,
  displayName: Name,
  groupId: Id,
  extraAssignmentIds: z.array(Id),
});

export const AssignmentSchema = z.object({
  id: Id,
  courseId: Id,
  teacherId: Id,
  groupIds: z.array(Id).min(1, "ต้องมีอย่างน้อย 1 กลุ่มเรียน"),
  periodsPerWeek: z.number().int().min(1).max(40).optional(),
  blockSizes: z.array(z.number().int().min(1).max(8)).optional(),
  fixedRoomId: z.string().optional(),
});

export const ActivitySchema = z
  .object({
    id: Id,
    code: CodeSchema,
    name: Name,
    day: z.number().int().min(0).max(6),
    startPeriod: z.number().int().min(1).max(30),
    length: z.number().int().min(1).max(13),
    appliesToAll: z.boolean(),
    teacherIds: z.array(Id),
    groupIds: z.array(Id),
    roomId: z.string().optional(),
    countsAsLoad: z.boolean(),
  })
  .refine((a) => a.appliesToAll || a.teacherIds.length + a.groupIds.length > 0, {
    path: ["groupIds"],
    message: "ต้องระบุครูหรือกลุ่มเรียนอย่างน้อย 1 รายการ (หรือเลือก 'ทุกคน')",
  });

export const PeriodSchema = z.object({
  no: z.number().int().min(1),
  start: HHmm,
  end: HHmm,
  isBreak: z.boolean().optional(),
  label: z.string().optional(),
});

export const TimeStructureSchema = z
  .object({
    days: z
      .array(
        z.object({
          index: z.number().int().min(0).max(6),
          label: z.string().min(1),
          short: z.string().min(1),
          active: z.boolean(),
        }),
      )
      .min(1),
    periods: z.array(PeriodSchema).min(1).max(30),
    preActivity: z.object({ label: z.string(), start: HHmm, end: HHmm }).optional(),
  })
  .superRefine((t, ctx) => {
    t.periods.forEach((p, i) => {
      if (p.no !== i + 1) ctx.addIssue({ code: "custom", path: ["periods", i, "no"], message: "เลขคาบต้องเรียง 1..N ไม่ขาด" });
      if (p.start >= p.end) ctx.addIssue({ code: "custom", path: ["periods", i, "end"], message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม" });
      const prev = t.periods[i - 1];
      if (prev && prev.end > p.start)
        ctx.addIssue({ code: "custom", path: ["periods", i, "start"], message: `คาบ ${p.no} ทับซ้อนกับคาบ ${prev.no}` });
    });
    if (!t.days.some((d) => d.active)) ctx.addIssue({ code: "custom", path: ["days"], message: "ต้องเปิดอย่างน้อย 1 วัน" });
  });

export const SchoolSchema = z.object({
  id: Id,
  name: Name,
  departmentCode: z.string().optional(),
  departmentName: z.string().optional(),
  regularEndTime: HHmm,
  signatories: z.array(z.object({ name: z.string(), title: z.string() })).max(6),
});

export const WorkloadRuleSchema = z.object({
  id: Id,
  name: Name,
  role: z.enum(["teacher", "head"]),
  level: z.enum(["ปวช.", "ปวส."]),
  standardHours: z.number().int().min(1).max(50),
  note: z.string().optional(),
});

export const TermSchema = z.object({
  id: Id,
  year: z.string().regex(/^\d{4}$/, "ปีการศึกษาต้องเป็นตัวเลข 4 หลัก (พ.ศ.)"),
  term: z.string().regex(/^[1-3]$/, "ภาคเรียนต้องเป็น 1, 2 หรือ 3"),
  status: z.enum(["setup", "active", "archived"]),
});

export const PlacementSchema = z.object({
  assignmentId: Id,
  block: z.number().int().min(0),
  day: z.number().int().min(0).max(6),
  period: z.number().int().min(1),
  roomId: Id,
});

export const DatasetSchema = z.object({
  school: SchoolSchema,
  term: TermSchema,
  time: TimeStructureSchema,
  courses: z.array(CourseSchema),
  teachers: z.array(TeacherSchema),
  rooms: z.array(RoomSchema),
  groups: z.array(GroupSchema),
  students: z.array(StudentSchema),
  assignments: z.array(AssignmentSchema),
  activities: z.array(ActivitySchema),
  workloadRules: z.array(WorkloadRuleSchema).optional(),
});

export const ENTITY_SCHEMAS = {
  courses: CourseSchema,
  teachers: TeacherSchema,
  rooms: RoomSchema,
  groups: GroupSchema,
  students: StudentSchema,
  assignments: AssignmentSchema,
  activities: ActivitySchema,
} as const;

/** แปลง ZodError เป็นข้อความภาษาไทยอ่านง่าย */
export function formatZodIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}
