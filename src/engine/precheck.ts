/**
 * Pre-check พร้อมหลักฐาน (InfeasibilityProof) — ทุกข้อเป็นเงื่อนไขจำเป็น (necessary condition)
 * ถ้าข้อใดไม่ผ่าน = พิสูจน์ได้ว่าไม่มีตารางที่ไม่ละเมิด Hard Constraints
 * P1 ภาระครู  P2 ภาระกลุ่ม/นักเรียน  P3 ไม่มีห้องที่ตรงเงื่อนไข  P4 block วางไม่ได้
 * P5 ครูไม่มีคุณสมบัติ  P6 pigeonhole ต่อชุดห้อง  P7 clique ในกราฟความขัดแย้ง (จำกัดต้นทุน)
 */
import { effectivePeriods, teacherName } from "@/shared/slots";
import type { Dataset } from "@/shared/types";
import { buildModel, type Model } from "./model";
import type { EntityRefKind, InfeasibilityProof } from "./types";

const MAX_P7_SEEDS = 400;
const MAX_P7_PROOFS = 5;
const MAX_P6_SETS = 300;

export function precheck(ds: Dataset, model?: Model): InfeasibilityProof[] {
  const m = model ?? buildModel(ds);
  const out: InfeasibilityProof[] = [];
  const { S, P, D } = m;
  const courseById = new Map(ds.courses.map((c) => [c.id, c]));
  const periodsOf = ds.assignments.map((a) => effectivePeriods(a, courseById.get(a.courseId)));
  const label = (ai: number) => {
    const a = ds.assignments[ai];
    const c = courseById.get(a.courseId);
    return `${c ? c.code : a.courseId} (${a.groupIds.map((g) => ds.groups.find((x) => x.id === g)?.code ?? g).join(",")})`;
  };
  const freeOf = (e: number) => {
    let n = 0;
    for (let s = 0; s < S; s++) if (m.gridOk[s] && !m.blocked[e * S + s]) n++;
    return n;
  };
  const freePerDay = (e: number) => {
    const arr = new Array(D).fill(0);
    for (let s = 0; s < S; s++) if (m.gridOk[s] && !m.blocked[e * S + s]) arr[Math.floor(s / P)]++;
    return arr as number[];
  };

  // ---- P1 ครู
  ds.teachers.forEach((t, ti) => {
    const asgs = ds.assignments.map((a, i) => (a.teacherId === t.id ? i : -1)).filter((i) => i >= 0);
    if (!asgs.length) return;
    const req = asgs.reduce((s, i) => s + periodsOf[i], 0);
    const name = teacherName(t);
    const ents = [{ kind: "teacher" as EntityRefKind, id: t.id }];
    const free = freeOf(ti);
    if (req > free) out.push({ rule: "P1", message: `${name} ต้องสอน ${req} คาบ แต่มีช่วงเวลาที่ว่างจริง (หักคาบพัก วันปิด เวลาไม่ว่าง และกิจกรรมล็อก) เพียง ${free} คาบ`, entities: ents, required: req, available: free });
    else if (req > t.maxPerWeek) out.push({ rule: "P1", message: `${name} ต้องสอน ${req} คาบ เกินภาระสูงสุด ${t.maxPerWeek} คาบ/สัปดาห์`, entities: ents, required: req, available: t.maxPerWeek });
    else {
      const cap = freePerDay(ti).reduce((s, n) => s + Math.min(n, t.maxPerDay), 0);
      if (req > cap) out.push({ rule: "P1", message: `${name} ต้องสอน ${req} คาบ แต่สอนได้ไม่เกิน ${t.maxPerDay} คาบ/วัน รวมทุกวันได้สูงสุด ${cap} คาบ`, entities: ents, required: req, available: cap });
    }
    for (const i of asgs) {
      const big = m.blocksByAsg[i].map((b) => m.blocks[b].len).find((l) => l > t.maxPerDay);
      if (big !== undefined) {
        out.push({ rule: "P1", message: `${label(i)} มี block ${big} คาบต่อเนื่อง แต่ ${name} สอนได้ไม่เกิน ${t.maxPerDay} คาบ/วัน`, entities: [...ents, { kind: "assignment", id: ds.assignments[i].id }], required: big, available: t.maxPerDay });
        break;
      }
    }
  });

  // ---- P2 กลุ่ม และนักเรียนที่ลงทะเบียนข้ามกลุ่ม
  const asgOfEnt: number[][] = Array.from({ length: m.E }, () => []);
  m.blocksByAsg.forEach((bs, ai) => {
    if (!bs.length) return;
    for (const e of m.blocks[bs[0]].ents) asgOfEnt[e].push(ai);
  });
  for (let e = m.T; e < m.roomOffset; e++) {
    const asgs = asgOfEnt[e];
    if (!asgs.length) continue;
    const req = asgs.reduce((s, i) => s + periodsOf[i], 0);
    const free = freeOf(e);
    if (req <= free) continue;
    if (e < m.T + m.G) {
      const g = ds.groups[e - m.T];
      out.push({ rule: "P2", message: `กลุ่ม ${g.code} ต้องเรียน ${req} คาบ แต่มีช่วงเวลาที่ใช้ได้ (หักคาบพัก วันปิด และกิจกรรมล็อก) เพียง ${free} คาบ`, entities: [{ kind: "group", id: g.id }], required: req, available: free });
    } else {
      const k = e - m.T - m.G;
      const sts = clusterStudents(ds, k);
      out.push({ rule: "P2", message: `นักเรียน ${sts.length} คนที่ลงทะเบียนเพิ่มข้ามกลุ่ม ต้องเรียนรวม ${req} คาบ แต่มีช่วงเวลาที่ใช้ได้เพียง ${free} คาบ`, entities: sts.map((id) => ({ kind: "student" as EntityRefKind, id })), required: req, available: free });
    }
  }

  // ---- P3 ไม่มีห้องที่ตรงเงื่อนไข
  ds.assignments.forEach((a, ai) => {
    const bs = m.blocksByAsg[ai];
    if (!bs.length) return;
    const bl = m.blocks[bs[0]];
    if (bl.roomOk.some((x) => x === 1)) return;
    const c = courseById.get(a.courseId);
    const why = a.fixedRoomId
      ? `ห้องที่กำหนดตายตัว (${ds.rooms.find((r) => r.id === a.fixedRoomId)?.code ?? a.fixedRoomId}) ไม่มีอยู่หรือจุไม่พอ ${bl.size} คน`
      : `ต้องการห้องประเภท ${c?.roomType ?? "-"}${c?.requiredEquipment.length ? ` ที่มีอุปกรณ์ ${c.requiredEquipment.join(", ")}` : ""} จุได้ ≥ ${bl.size} คน`;
    out.push({ rule: "P3", message: `${label(ai)} ไม่มีห้องใดตรงเงื่อนไข: ${why}`, entities: [{ kind: "assignment", id: a.id }, ...(c ? [{ kind: "course" as EntityRefKind, id: c.id }] : [])], required: 1, available: 0 });
  });

  // ---- P4 block วางไม่ได้
  for (const bl of m.blocks) {
    if (!bl.domainFallback) {
      // มีช่วงเวลา — ตรวจว่ามีห้องใดว่างพร้อมกันหรือไม่
      const okRooms = [...bl.rooms].filter((r) => bl.roomOk[r]);
      if (!okRooms.length) continue; // P3 รายงานแล้ว
      let any = false;
      for (const s of bl.starts) {
        for (const r of okRooms) {
          const base = (m.roomOffset + r) * S + s;
          let free = true;
          for (let k = 0; k < bl.len; k++) if (m.blocked[base + k]) free = false;
          if (free) {
            any = true;
            break;
          }
        }
        if (any) break;
      }
      if (!any)
        out.push({ rule: "P4", message: `${label(bl.a)} block ${bl.len} คาบ: ไม่มีช่วงเวลาใดที่ทั้งครู/กลุ่มว่างและมีห้องที่ตรงเงื่อนไขว่าง`, entities: [{ kind: "assignment", id: bl.assignmentId }], required: 1, available: 0 });
      continue;
    }
    let gridCount = 0;
    for (let d = 0; d < D; d++)
      for (let p = 0; p + bl.len <= P; p++) {
        let ok = true;
        for (let k = 0; k < bl.len; k++) if (!m.gridOk[d * P + p + k]) ok = false;
        if (ok) gridCount++;
      }
    if (gridCount === 0)
      out.push({ rule: "P4", message: `${label(bl.a)} มี block ${bl.len} คาบต่อเนื่อง ซึ่งวางไม่ได้ในวันใดเลย (คาบพักคั่นหรือวันสั้นเกินไป)`, entities: [{ kind: "assignment", id: bl.assignmentId }], required: bl.len, available: longestRun(m) });
    else
      out.push({ rule: "P4", message: `${label(bl.a)} block ${bl.len} คาบ: ไม่มีช่วงเวลาที่ครูและกลุ่มเรียนว่างพร้อมกัน (หลังหักเวลาไม่ว่างและกิจกรรมล็อก)`, entities: [{ kind: "assignment", id: bl.assignmentId }], required: 1, available: 0 });
  }

  // ---- P5 ครูไม่มีคุณสมบัติ
  for (const a of ds.assignments) {
    const t = ds.teachers.find((x) => x.id === a.teacherId);
    const c = courseById.get(a.courseId);
    if (t && c && t.qualifiedCourseIds.length > 0 && !t.qualifiedCourseIds.includes(c.id))
      out.push({ rule: "P5", message: `${teacherName(t)} ถูกมอบหมายสอน ${c.code} ${c.name} แต่ไม่มีคุณสมบัติ (ข้อมูลมอบหมายไม่ถูกต้อง)`, entities: [{ kind: "teacher", id: t.id }, { kind: "course", id: c.id }, { kind: "assignment", id: a.id }], required: 1, available: 0 });
  }

  // ---- P6 pigeonhole ต่อชุดห้อง (ไม่รวมห้อง external ที่ใช้ร่วมกันได้)
  const roomFree = ds.rooms.map((_, r) => freeOf(m.roomOffset + r));
  const candSets = new Map<string, number[]>();
  const asgRooms: (number[] | null)[] = ds.assignments.map((_, ai) => {
    const bs = m.blocksByAsg[ai];
    if (!bs.length) return null;
    const bl = m.blocks[bs[0]];
    const rs = [...bl.rooms].filter((r) => bl.roomOk[r]);
    if (!rs.length || rs.some((r) => !m.exclusive[m.roomOffset + r])) return null;
    return rs;
  });
  for (const rs of asgRooms) if (rs && candSets.size < MAX_P6_SETS) candSets.set(rs.join(","), rs);
  const byType = new Map<string, number[]>();
  ds.rooms.forEach((r, i) => {
    if (r.type === "external") return;
    byType.set(r.type, [...(byType.get(r.type) ?? []), i]);
  });
  for (const rs of byType.values()) if (candSets.size < MAX_P6_SETS + 20) candSets.set(rs.join(","), rs);
  const p6seen = new Set<string>();
  for (const rs of candSets.values()) {
    const set = new Set(rs);
    let demand = 0;
    const members: number[] = [];
    asgRooms.forEach((ar, ai) => {
      if (ar && ar.every((r) => set.has(r))) {
        demand += periodsOf[ai];
        members.push(ai);
      }
    });
    const supply = rs.reduce((s, r) => s + roomFree[r], 0);
    if (demand > supply) {
      const key = members.join(",");
      if (p6seen.has(key)) continue;
      p6seen.add(key);
      const types = [...new Set(rs.map((r) => ds.rooms[r].type))].join("/");
      out.push({ rule: "P6", message: `วิชาที่ใช้ได้เฉพาะห้อง ${rs.map((r) => ds.rooms[r].code).join(", ")} (ประเภท ${types}) ต้องใช้รวม ${demand} คาบ แต่ห้องเหล่านี้ว่างรวมเพียง ${supply} คาบ`, entities: rs.map((r) => ({ kind: "room" as EntityRefKind, id: ds.rooms[r].id })), required: demand, available: supply });
    }
  }

  // ---- P7 clique (greedy จำกัดต้นทุน)
  out.push(...cliqueProofs(m, periodsOf, asgOfEnt, label));
  return out;
}

function longestRun(m: Model): number {
  let best = 0;
  for (let d = 0; d < m.D; d++) {
    let run = 0;
    for (let p = 0; p < m.P; p++) {
      run = m.gridOk[d * m.P + p] ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  return best;
}

function clusterStudents(ds: Dataset, k: number): string[] {
  const keys: string[] = [];
  const map = new Map<string, string[]>();
  const asgIds = new Set(ds.assignments.map((a) => a.id));
  for (const st of ds.students) {
    const extras = [...new Set(st.extraAssignmentIds.filter((x) => asgIds.has(x)))].sort();
    if (!extras.length || !ds.groups.some((g) => g.id === st.groupId)) continue;
    const key = `${st.groupId}|${extras.join(",")}`;
    if (!map.has(key)) {
      map.set(key, []);
      keys.push(key);
    }
    map.get(key)!.push(st.id);
  }
  return map.get(keys[k]) ?? [];
}

function cliqueProofs(m: Model, periodsOf: number[], asgOfEnt: number[][], label: (ai: number) => string): InfeasibilityProof[] {
  const A = m.A;
  const ents: number[][] = m.blocksByAsg.map((bs) => (bs.length ? m.blocks[bs[0]].ents : []));
  const nb: Set<number>[] = Array.from({ length: A }, () => new Set<number>());
  for (let e = 0; e < m.roomOffset; e++) {
    const list = asgOfEnt[e];
    for (const x of list) for (const y of list) if (x !== y) nb[x].add(y);
  }
  const seeds = [...Array(A).keys()].filter((i) => nb[i].size > 0).sort((x, y) => periodsOf[y] - periodsOf[x] || x - y).slice(0, MAX_P7_SEEDS);
  const out: InfeasibilityProof[] = [];
  const seen = new Set<string>();
  const S = m.S;
  for (const seed of seeds) {
    const cands = [...nb[seed]].sort((x, y) => periodsOf[y] - periodsOf[x] || x - y);
    const clique = [seed];
    for (const c of cands) if (clique.every((q) => nb[c].has(q))) clique.push(c);
    if (clique.length < 3) continue;
    // ถ้ามี entity ร่วมกันทุกตัว → เป็นกรณีของ P1/P2 อยู่แล้ว
    const common = ents[clique[0]].filter((e) => clique.every((q) => ents[q].includes(e)));
    if (common.length) continue;
    const req = clique.reduce((s, q) => s + periodsOf[q], 0);
    let avail = 0;
    for (let s = 0; s < S; s++) {
      if (!m.gridOk[s]) continue;
      if (clique.some((q) => ents[q].every((e) => !m.blocked[e * S + s]))) avail++;
    }
    if (req <= avail) continue;
    const key = [...clique].sort((x, y) => x - y).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rule: "P7",
      message: `รายวิชา ${clique.map(label).join(", ")} ขัดแย้งกันทุกคู่ (ใช้ครู/กลุ่ม/นักเรียนร่วมกัน) จึงต้องอยู่คนละคาบทั้งหมด รวม ${req} คาบ แต่มีช่วงเวลาที่ใช้ได้เพียง ${avail} คาบ`,
      entities: clique.map((q) => ({ kind: "assignment" as EntityRefKind, id: m.assignments[q].id })),
      required: req,
      available: avail,
    });
    if (out.length >= MAX_P7_PROOFS) break;
  }
  return out;
}
