/**
 * คำอธิบายผลแบบ rule-based (ภาษาไทย) — ไม่ใช้ LLM
 */
import { teacherName } from "@/shared/slots";
import { ROOM_TYPE_LABEL, type Dataset } from "@/shared/types";
import {
  SOFT_KEYS,
  SOFT_LABEL,
  STATUS_LABEL,
  type InfeasibilityProof,
  type Score,
  type SolverStatus,
  type Violation,
  type Weights,
} from "./types";

const HARD_LABEL: Record<string, string> = {
  TEACHER_CLASH: "ครูสอนชนกัน",
  ROOM_CLASH: "ห้องถูกใช้ซ้อนกัน",
  GROUP_CLASH: "กลุ่มเรียนมีวิชาชนกัน",
  STUDENT_CLASH: "นักเรียนลงทะเบียนข้ามกลุ่มชนกัน",
  PERIOD_COUNT: "จำนวนคาบไม่ครบ/เกิน",
  BLOCK_SPLIT: "คาบต่อเนื่องคร่อมวัน",
  UNQUALIFIED: "ครูไม่มีคุณสมบัติ",
  ROOM_CAPACITY: "ห้องจุไม่พอ",
  ROOM_TYPE: "ประเภทห้องไม่ตรง",
  ROOM_EQUIPMENT: "อุปกรณ์ในห้องไม่ครบ",
  UNAVAILABLE: "ทับเวลาที่ไม่พร้อม",
  BREAK: "ทับคาบพัก",
  LOCKED: "ทับกิจกรรมล็อก",
  TEACHER_LOAD: "ภาระครูเกินกำหนด",
  INACTIVE_DAY: "อยู่ในวันที่ปิด",
  OUT_OF_GRID: "อยู่นอกตาราง",
  UNKNOWN_REF: "อ้างอิงข้อมูลที่ไม่มีอยู่",
};

const PROOF_HINT: Record<string, string> = {
  P1: "ลดภาระครู/แบ่งรายวิชาให้ครูท่านอื่น หรือเพิ่มเวลาว่าง/ภาระสูงสุดของครู",
  P2: "ลดจำนวนคาบของกลุ่ม หรือลดกิจกรรมล็อก/เปิดคาบเพิ่ม",
  P3: "เพิ่มห้องที่ตรงประเภท/อุปกรณ์/ความจุ หรือแก้เงื่อนไขห้องของรายวิชา",
  P4: "ปรับการแบ่ง block (blockSizes) หรือโครงสร้างคาบพัก/เวลาไม่ว่าง",
  P5: "แก้ข้อมูลการมอบหมายให้ครูที่มีคุณสมบัติ หรือเพิ่มคุณสมบัติครู",
  P6: "เพิ่มห้องประเภทนั้น หรือลดคาบที่ต้องใช้ห้องประเภทนั้น",
  P7: "แยกครู/กลุ่มที่ใช้ร่วมกันของรายวิชาชุดนี้ หรือลดจำนวนคาบ",
};

export function explain(
  ds: Dataset,
  status: SolverStatus,
  score: Score,
  violations: Violation[],
  proofs: InfeasibilityProof[],
  weights: Weights,
): string[] {
  const out: string[] = [];
  out.push(`สถานะ: ${STATUS_LABEL[status]}`);
  if (proofs.length) {
    const rules = [...new Set(proofs.map((p) => p.rule))];
    out.push(`พบหลักฐานว่าจัดตารางไม่ได้ ${proofs.length} ข้อ (กฎ ${rules.join(", ")})`);
    for (const p of proofs.slice(0, 5)) out.push(`• [${p.rule}] ${p.message} (ต้องการ ${p.required} / มี ${p.available})`);
    for (const r of rules) out.push(`ข้อเสนอแนะ (${r}): ${PROOF_HINT[r]}`);
  }
  const hard = violations.filter((v) => v.severity === "hard");
  if (hard.length) {
    const byType = new Map<string, number>();
    hard.forEach((v) => byType.set(v.type, (byType.get(v.type) ?? 0) + 1));
    const top = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    out.push(`ข้อขัดแย้ง Hard ${hard.length} รายการ: ${top.map(([t, n]) => `${HARD_LABEL[t] ?? t} ${n}`).join(", ")}`);
    const cnt = new Map<string, { kind: string; id: string; n: number }>();
    for (const v of hard)
      for (const e of v.entities)
        if (e.kind === "teacher" || e.kind === "room" || e.kind === "group") {
          const k = `${e.kind}:${e.id}`;
          const c = cnt.get(k) ?? { kind: e.kind, id: e.id, n: 0 };
          c.n++;
          cnt.set(k, c);
        }
    const topEnt = [...cnt.values()].sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)).slice(0, 3);
    for (const e of topEnt) {
      if (e.kind === "teacher") {
        const t = ds.teachers.find((x) => x.id === e.id);
        const name = t ? `${t.code} ${teacherName(t)}` : e.id;
        out.push(`ครู ${name} เกี่ยวข้องกับข้อขัดแย้ง ${e.n} รายการ — ข้อเสนอแนะ: ลดภาระครู ${name} หรือเพิ่มเวลาว่าง`);
      } else if (e.kind === "room") {
        const r = ds.rooms.find((x) => x.id === e.id);
        out.push(`ห้อง ${r?.code ?? e.id} เกี่ยวข้องกับข้อขัดแย้ง ${e.n} รายการ — ข้อเสนอแนะ: เพิ่มห้องประเภท ${r ? ROOM_TYPE_LABEL[r.type] : "เดียวกัน"}`);
      } else {
        const g = ds.groups.find((x) => x.id === e.id);
        out.push(`กลุ่ม ${g?.code ?? e.id} เกี่ยวข้องกับข้อขัดแย้ง ${e.n} รายการ — ข้อเสนอแนะ: ตรวจจำนวนคาบ/กิจกรรมล็อกของกลุ่ม`);
      }
    }
    if (!proofs.length && status !== "feasible")
      out.push("ไม่มีหลักฐานว่าจัดไม่ได้ — ยังไม่พบตารางที่ไม่ละเมิด Hard Constraints ภายในเวลาที่กำหนด ลองเพิ่มเวลา/เปลี่ยน seed หรือใช้โหมด Agent");
  } else {
    out.push("ไม่มีข้อขัดแย้ง Hard (ตรวจซ้ำด้วย validator อิสระแล้ว)");
  }
  const softTop = SOFT_KEYS.map((k) => ({ k, raw: score.breakdown[k], wv: score.breakdown[k] * (weights[k] ?? 0) }))
    .filter((x) => x.raw > 0)
    .sort((a, b) => b.wv - a.wv)
    .slice(0, 3);
  out.push(`คะแนน Soft รวม (ถ่วงน้ำหนัก) ${round(score.soft)}${softTop.length ? `: มากสุดคือ ${softTop.map((x) => `${SOFT_LABEL[x.k]} ${x.raw}`).join(", ")}` : ""}`);
  return out;
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}
