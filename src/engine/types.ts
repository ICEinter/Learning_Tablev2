/**
 * สัญญา (contract) ของ engine — TypeScript บริสุทธิ์ ไม่พึ่ง UI/Firebase
 * รันได้ทั้ง Node (test/bench) และ Web Worker
 */
import type { ID, Placement, SlotRef } from "@/shared/types";

export type SoftKey =
  | "teacherGaps"
  | "studentGaps"
  | "dayBalance"
  | "roomChanges"
  | "preferredTimes"
  | "sameCourseSameDay"
  | "lateHours";

export type Weights = Record<SoftKey, number>;

export const SOFT_KEYS: SoftKey[] = [
  "teacherGaps",
  "studentGaps",
  "dayBalance",
  "roomChanges",
  "preferredTimes",
  "sameCourseSameDay",
  "lateHours",
];

export const SOFT_LABEL: Record<SoftKey, string> = {
  teacherGaps: "คาบว่างคั่นของครู",
  studentGaps: "คาบว่างคั่นของผู้เรียน",
  dayBalance: "ความสมดุลภาระรายวัน",
  roomChanges: "การย้ายห้องของกลุ่มเรียน",
  preferredTimes: "เวลาที่ครูขอเลี่ยง",
  sameCourseSameDay: "วิชาเดียวกันซ้ำวันเดียว",
  lateHours: "คาบนอกเวลาราชการ",
};

export const DEFAULT_WEIGHTS: Weights = {
  teacherGaps: 3,
  studentGaps: 3,
  dayBalance: 2,
  roomChanges: 1,
  preferredTimes: 4,
  sameCourseSameDay: 2,
  lateHours: 2,
};

export type HardViolationType =
  | "TEACHER_CLASH"
  | "ROOM_CLASH"
  | "GROUP_CLASH"
  | "STUDENT_CLASH"
  | "PERIOD_COUNT"
  | "BLOCK_SPLIT"
  | "UNQUALIFIED"
  | "ROOM_CAPACITY"
  | "ROOM_TYPE"
  | "ROOM_EQUIPMENT"
  | "UNAVAILABLE"
  | "BREAK"
  | "LOCKED"
  | "TEACHER_LOAD"
  | "INACTIVE_DAY"
  | "OUT_OF_GRID"
  | "UNKNOWN_REF";

export type ViolationType = HardViolationType | SoftKey;

export type EntityRefKind = "teacher" | "room" | "group" | "student" | "assignment" | "course" | "activity";

export interface Violation {
  type: ViolationType;
  severity: "hard" | "soft";
  message: string; // ภาษาไทย
  entities: { kind: EntityRefKind; id: ID }[];
  slots: SlotRef[];
}

export type ProofRule = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7";

export interface InfeasibilityProof {
  rule: ProofRule;
  message: string; // ภาษาไทย อธิบายหลักฐาน
  entities: { kind: EntityRefKind; id: ID }[];
  required: number;
  available: number;
}

export interface Score {
  hard: number;
  soft: number; // ผลรวมถ่วงน้ำหนัก
  breakdown: Record<SoftKey, number>; // ค่าดิบ (ยังไม่ถ่วงน้ำหนัก)
}

export interface ValidationResult {
  violations: Violation[];
  score: Score;
}

export type Algorithm = "heuristic" | "ga" | "tabu" | "agent";

export interface GAOptions {
  populationSize: number;
  eliteCount: number;
  tournamentK: number;
  crossoverRate: number;
  mutationRate: number;
  stallGenerations: number;
}

export const DEFAULT_GA: GAOptions = {
  populationSize: 40,
  eliteCount: 2,
  tournamentK: 3,
  crossoverRate: 0.8,
  mutationRate: 0.3,
  stallGenerations: 150,
};

export interface SolverOptions {
  algorithm: Algorithm;
  seed: number;
  timeLimitMs: number;
  maxIterations?: number;
  weights: Weights;
  ga?: Partial<GAOptions>;
  agent?: { maxRounds: number; targetSoft?: number };
  /** เริ่มจากตารางเดิม (warm start) */
  initial?: Placement[];
}

export type SolverStatus = "feasible" | "partial" | "timeout" | "infeasible-proven" | "cancelled" | "error";

export const STATUS_LABEL: Record<SolverStatus, string> = {
  feasible: "พบตารางที่ไม่ละเมิด Hard Constraints",
  partial: "ยังมีข้อขัดแย้ง (ผลดีที่สุดที่หาได้)",
  timeout: "หมดเวลา — ยังไม่พบตารางที่ไม่ละเมิด Hard Constraints ภายในเวลาที่กำหนด",
  "infeasible-proven": "พิสูจน์ได้ว่าข้อมูลนี้จัดตารางไม่ได้ (มีหลักฐาน)",
  cancelled: "ยกเลิกโดยผู้ใช้",
  error: "เกิดข้อผิดพลาด",
};

export interface ProgressEvent {
  phase: "precheck" | "heuristic" | "ga" | "tabu" | "agent" | "validate";
  round?: number;
  iteration: number;
  elapsedMs: number;
  bestHard: number;
  bestSoft: number;
  message?: string;
}

export interface AgentRoundLog {
  round: number;
  algorithm: "heuristic" | "ga";
  seed: number;
  timeLimitMs: number;
  weights: Weights;
  ga?: Partial<GAOptions>;
  durationMs: number;
  hard: number;
  soft: number;
  status: SolverStatus;
  /** การตัดสินใจของ agent หลังรอบนี้ (ภาษาไทย) */
  decision: string;
}

export interface SolverResult {
  status: SolverStatus;
  placements: Placement[];
  score: Score;
  violations: Violation[];
  proofs: InfeasibilityProof[];
  stats: {
    algorithm: Algorithm;
    seed: number;
    iterations: number;
    elapsedMs: number;
    /** ประวัติคะแนนดีที่สุด (สุ่มตัวอย่างไม่เกิน ~200 จุด) */
    bestHistory: { t: number; hard: number; soft: number }[];
  };
  log: string[];
  agentRounds?: AgentRoundLog[];
  explanation: string[];
}

export interface SolveHooks {
  onProgress?: (e: ProgressEvent) => void;
  signal?: { cancelled: boolean };
}

/** โปรโตคอล Web Worker */
export type WorkerIn =
  | { type: "solve"; id: string; dataset: import("@/shared/types").Dataset; options: SolverOptions }
  | { type: "cancel"; id: string };

export type WorkerOut =
  | { type: "progress"; id: string; event: ProgressEvent }
  | { type: "result"; id: string; result: SolverResult }
  | { type: "error"; id: string; message: string };
