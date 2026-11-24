"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MiniLineChart } from "@/components/charts/mini-line-chart";
import { CompareRunner } from "@/components/solver/compare-runner";
import { ResultPanel } from "@/components/solver/result-panel";
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { DEFAULT_GA, DEFAULT_WEIGHTS, SOFT_KEYS, SOFT_LABEL, precheck, type Algorithm, type Weights } from "@/engine";
import { newId } from "@/lib/id";
import { useSolver } from "@/lib/solver/use-solver";
import { useData } from "@/lib/store/data-context";
import { checkDataset } from "@/shared/integrity";
import { termLabel } from "@/shared/slots";

const ALGO_LABEL: Record<Algorithm, string> = {
  heuristic: "Heuristic (Baseline)",
  ga: "Genetic Algorithm (GA)",
  tabu: "Conflict-Driven Tabu Search",
  agent: "Scheduling Agent (AI)",
};

interface AlgoMeta {
  id: Algorithm;
  name: string;
  badge: string;
  badgeClass: string;
  desc: string;
  suitedFor: string;
  pros: string[];
}

const ALGO_DETAILS: AlgoMeta[] = [
  {
    id: "heuristic",
    name: "1. Greedy Heuristic (MRV)",
    badge: "⚡ เร็วที่สุด (< 50ms)",
    badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
    desc: "จัดวิชาที่เงื่อนไขยากสุดก่อน (Most-Constrained-First) วางลงช่องแรกที่ว่างทันที",
    suitedFor: "โจทย์ขนาดเล็ก–กลาง หรือต้องการผลลัพธ์ทันทีเพื่อดูภาพรวม และใช้เป็น Baseline",
    pros: ["ความเร็วสูงสุดระดับมิลลิวินาที", "ผลลัพธ์คงที่แน่นอน (Deterministic)", "ไม่กินทรัพยากรเครื่อง"],
  },
  {
    id: "ga",
    name: "2. Genetic Algorithm (GA + Repair)",
    badge: "🏆 สมดุล & คุณภาพสูงสุด",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400",
    desc: "วิวัฒนาการประชากรตาราง ค้นหาทั่ว Search Space พร้อม Domain Repair ซ่อมจุดชนทันที",
    suitedFor: "โจทย์มาตรฐานถึงซับซ้อนสูง และต้องการตารางที่เกลี่ยภาระสอนและลดคาบว่างได้ดีที่สุด",
    pros: ["ค้นหาครอบคลุมทั่ว Search Space", "ปรับน้ำหนัก Soft Constraints ได้อิสระ", "ซ่อมจุดชนแม่นยำ ไม่สุ่มมั่ว"],
  },
  {
    id: "tabu",
    name: "3. Conflict-Driven Tabu Search",
    badge: "🎯 แก้ชนตรงจุด (< 1s)",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
    desc: "ตรวจหาเฉพาะคาบที่ชน แล้วสลับย้ายเฉพาะจุดที่มีปัญหา โดยมี Tabu List ป้องกันการวนลูป",
    suitedFor: "โจทย์ที่มีความหนาแน่นสูง และต้องการล้างข้อขัดแย้ง Hard ให้เหลือ 0 ในเวลาสั้นที่สุด",
    pros: ["พุ่งเป้าแก้เฉพาะจุดที่ชน ไม่เสียเวลาคำนวณยีนอื่น", "กำจัด Hard Conflict ได้เร็วมาก", "ใช้หน่วยความจำต่ำมาก"],
  },
  {
    id: "agent",
    name: "4. Scheduling Agent (AI อัตโนมัติ)",
    badge: "🤖 AI Meta-Controller",
    badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400",
    desc: "ผู้ช่วย AI กึ่งอัตโนมัติ: ประเมินโจทย์ → ตั้งค่า GA → รัน → ตรวจสอบ → ปรับจูนค้นหาซ้ำ",
    suitedFor: "ผู้ใช้ที่ไม่ต้องการปรับจูนตัวเลขเอง และต้องการดู Trace Log เหตุผลการตัดสินใจภาษาไทย",
    pros: ["ปรับ Hyperparameters อัตโนมัติ", "มี Log ภาษาไทยอธิบายทุกขั้นตอน", "ฟื้นตัวจากการติดหล่มได้อัตโนมัติ"],
  },
];

export default function SolvePage() {
  const { dataset, saveTimetable, loadRayongData } = useData();
  const { job, run, cancel } = useSolver();
  const [algorithm, setAlgorithm] = useState<Algorithm>("agent");
  const [seed, setSeed] = useState(1);
  const [timeSec, setTimeSec] = useState(10);
  const [maxRounds, setMaxRounds] = useState(4);
  const [population, setPopulation] = useState(DEFAULT_GA.populationSize);
  const [mutation, setMutation] = useState(DEFAULT_GA.mutationRate);
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS });
  const [savedId, setSavedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"single" | "compare">("single");

  const dataErrors = useMemo(() => checkDataset(dataset).filter((i) => i.level === "error"), [dataset]);
  const proofs = useMemo(() => precheck(dataset), [dataset]);
  const running = job?.state === "running";

  const start = (s = seed) => {
    setSavedId(null);
    run(dataset, {
      algorithm,
      seed: s,
      timeLimitMs: Math.max(1, timeSec) * 1000,
      weights,
      ga: { populationSize: population, mutationRate: mutation },
      agent: { maxRounds },
    });
  };

  const last = job?.progress[job.progress.length - 1];
  const elapsed = last?.elapsedMs ?? 0;
  const pct = job ? Math.min(100, (elapsed / (job.options.timeLimitMs || 1)) * 100) : 0;

  const history = job?.result?.stats.bestHistory ?? job?.progress.map((p) => ({ t: p.elapsedMs, hard: p.bestHard, soft: p.bestSoft })) ?? [];

  const save = async () => {
    const r = job?.result;
    if (!r || !job) return;
    const id = newId("tt");
    const now = new Date().toISOString();
    await saveTimetable({
      id,
      termId: dataset.term.id,
      label: `${ALGO_LABEL[job.options.algorithm].split(" ")[0]} seed ${r.stats.seed} · ${new Date().toLocaleString("th-TH")}`,
      status: "draft",
      placements: r.placements,
      createdAt: now,
      updatedAt: now,
      source: { algorithm: job.options.algorithm, seed: r.stats.seed, jobId: job.id },
      metrics: { hard: r.score.hard, soft: r.score.soft, elapsedMs: r.stats.elapsedMs },
      note: r.status,
    });
    setSavedId(id);
  };

  return (
    <div>
      <PageHeader
        title="จัดตารางอัตโนมัติ"
        description={`ภาคเรียน ${termLabel(dataset)} · คำนวณใน Web Worker บนเบราว์เซอร์ (ไม่บล็อกหน้าจอ) — ผลจะถูกตรวจด้วย validator อิสระก่อนบันทึก`}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant={tab === "single" ? "primary" : "secondary"} onClick={() => setTab("single")}>
            คำนวณตาราง
          </Button>
          <Button variant={tab === "compare" ? "primary" : "secondary"} onClick={() => setTab("compare")}>
            เปรียบเทียบ 3 อัลกอริทึม
          </Button>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (confirm("ต้องการโหลดชุดข้อมูลจริง วิทยาลัยเทคนิคระยอง ภาคเรียนที่ 2/2569 แทนข้อมูลปัจจุบันใช่หรือไม่?")) {
              await loadRayongData();
            }
          }}
        >
          🏫 โหลดข้อมูลจริง: วท.ระยอง 2/2569
        </Button>
      </div>

      <div className="mb-4 grid gap-3">
        {dataErrors.length > 0 && (
          <Alert tone="danger" title={`ข้อมูลมีข้อผิดพลาด ${dataErrors.length} รายการ`}>
            ควรแก้ก่อนจัดตาราง เช่น: {dataErrors.slice(0, 3).map((e) => e.message).join(" · ")}{" "}
            <Link className="text-accent underline" href="/admin">
              ดูทั้งหมดที่แดชบอร์ด
            </Link>
          </Alert>
        )}
        {proofs.length > 0 ? (
          <Alert tone="danger" title="Pre-check: พบหลักฐานว่าข้อมูลนี้จัดตารางไม่ได้">
            <ul className="mt-1 list-disc pl-5">
              {proofs.map((p, i) => (
                <li key={i}>
                  <Badge tone="danger">{p.rule}</Badge> {p.message} (ต้องการ {p.required} / มี {p.available})
                </li>
              ))}
            </ul>
          </Alert>
        ) : (
          <Alert tone="ok" title="Pre-check ผ่าน">
            ไม่พบหลักฐานว่าข้อมูลขัดแย้งจนจัดไม่ได้ (ไม่ได้หมายความว่ารับประกันว่าจะพบคำตอบ)
          </Alert>
        )}
      </div>

      {tab === "compare" ? (
        <CompareRunner />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[480px_1fr]">
          <Card title="ตั้งค่าการคำนวณ">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  เลือกอัลกอริทึมจัดตาราง (คลิกเพื่อเลือก)
                </label>
                <div className="flex flex-col gap-2">
                  {ALGO_DETAILS.map((a) => {
                    const active = algorithm === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={running}
                        onClick={() => setAlgorithm(a.id)}
                        className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all ${
                          active
                            ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20 dark:border-emerald-400"
                            : "border-slate-200 hover:border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`} />
                            {a.name}
                          </span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${a.badgeClass}`}>
                            {a.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {a.desc}
                        </p>
                        <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-0.5 text-[11px]">
                          <div className="text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-700 dark:text-slate-300">ความเหมาะสม:</span> {a.suitedFor}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5">
                            <span className="font-medium text-slate-700 dark:text-slate-300">ข้อดี:</span>
                            {a.pros.map((p, i) => (
                              <span key={i} className="inline-flex items-center gap-1">
                                • {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Seed" hint="seed เดิม = ผลเดิม">
                  {(id) => <Input id={id} type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} disabled={running} />}
                </Field>
                <Field label="เวลาสูงสุด (วินาที)">
                  {(id) => (
                    <Input id={id} type="number" min={1} max={600} value={timeSec} onChange={(e) => setTimeSec(Number(e.target.value) || 1)} disabled={running} />
                  )}
                </Field>
              </div>
              {algorithm === "agent" && (
                <Field label="จำนวนรอบสูงสุดของ Agent" hint="Agent ปรับได้เฉพาะ seed/เวลา/พารามิเตอร์ GA/น้ำหนัก Soft — ไม่ผ่อน Hard">
                  {(id) => <Input id={id} type="number" min={1} max={10} value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value) || 1)} disabled={running} />}
                </Field>
              )}
              {algorithm !== "heuristic" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ขนาดประชากร (GA)">
                    {(id) => <Input id={id} type="number" min={4} max={300} value={population} onChange={(e) => setPopulation(Number(e.target.value) || 4)} disabled={running} />}
                  </Field>
                  <Field label="อัตรากลายพันธุ์">
                    {(id) => (
                      <Input id={id} type="number" step={0.05} min={0} max={1} value={mutation} onChange={(e) => setMutation(Number(e.target.value))} disabled={running} />
                    )}
                  </Field>
                </div>
              )}
              <details>
                <summary className="cursor-pointer text-sm font-medium">น้ำหนัก Soft Constraints</summary>
                <div className="mt-3 flex flex-col gap-2">
                  {SOFT_KEYS.map((k) => (
                    <label key={k} className="grid grid-cols-[1fr_120px_28px] items-center gap-2 text-sm">
                      <span>{SOFT_LABEL[k]}</span>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={weights[k]}
                        disabled={running}
                        onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
                        className="accent-[var(--color-accent)]"
                        aria-label={`น้ำหนัก ${SOFT_LABEL[k]}`}
                      />
                      <span className="text-right tabular-nums">{weights[k]}</span>
                    </label>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setWeights({ ...DEFAULT_WEIGHTS })} disabled={running}>
                    คืนค่าเริ่มต้น
                  </Button>
                </div>
              </details>
              <div className="flex flex-wrap gap-2">
                {!running ? (
                  <>
                    <Button variant="primary" onClick={() => start()}>
                      เริ่มคำนวณ
                    </Button>
                    {job && (
                      <Button
                        onClick={() => {
                          const s = Math.floor(Math.random() * 1_000_000);
                          setSeed(s);
                          start(s);
                        }}
                      >
                        เริ่มใหม่ด้วย seed ใหม่
                      </Button>
                    )}
                  </>
                ) : (
                  <Button variant="danger" onClick={cancel}>
                    ยกเลิก
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <Card
              title="สถานะงาน"
              actions={job && <Badge tone={job.state === "running" ? "accent" : job.state === "done" ? "ok" : job.state === "error" ? "danger" : "warn"}>{STATE_LABEL[job.state]}</Badge>}
            >
              {!job ? (
                <p className="text-sm text-muted">ยังไม่ได้เริ่มคำนวณ — ตั้งค่าแล้วกด &ldquo;เริ่มคำนวณ&rdquo;</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>
                        {last ? `${PHASE_LABEL[last.phase] ?? last.phase}${last.round ? ` รอบที่ ${last.round}` : ""} · รอบคำนวณ ${last.iteration.toLocaleString()}` : "กำลังเริ่ม…"}
                      </span>
                      <span className="tabular-nums text-muted">{(elapsed / 1000).toFixed(1)} / {(job.options.timeLimitMs / 1000).toFixed(0)} วินาที</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-page" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-accent transition-[width]" style={{ width: `${job.state === "running" ? pct : 100}%` }} />
                    </div>
                    {last?.message && <p className="mt-1 text-xs text-muted">{last.message}</p>}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <MiniLineChart title="ข้อขัดแย้ง Hard ที่ดีที่สุด (ยิ่งต่ำยิ่งดี)" points={history.map((h) => ({ x: h.t, y: h.hard }))} formatY={(v) => Math.round(v).toString()} />
                    <MiniLineChart title="คะแนน Soft ถ่วงน้ำหนัก (ยิ่งต่ำยิ่งดี)" points={history.map((h) => ({ x: h.t, y: h.soft }))} />
                  </div>
                  {job.error && <Alert tone="danger">{job.error}</Alert>}
                </div>
              )}
            </Card>

            {job?.result && (
              <ResultPanel
                result={job.result}
                onSave={save}
                savedLink={savedId ? `/admin/timetables/${savedId}` : undefined}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const STATE_LABEL = { idle: "ว่าง", running: "กำลังคำนวณ", done: "เสร็จสิ้น", cancelled: "ยกเลิกแล้ว", error: "ผิดพลาด" } as const;
const PHASE_LABEL: Record<string, string> = { precheck: "ตรวจสอบเบื้องต้น", heuristic: "Heuristic", ga: "Genetic Algorithm", agent: "Agent", validate: "ตรวจผล" };
