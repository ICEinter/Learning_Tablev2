"use client";
/**
 * เปรียบเทียบ Heuristic baseline กับ GA จากการรันจริงในเบราว์เซอร์
 * ทุกตัวเลขในตารางมาจากผลการรันจริง (เวลา, Hard, Soft, seed) — ไม่มีการแต่งผล
 */
import { useRef, useState } from "react";
import { Alert, Button, Card, DataTable, Field, Input } from "@/components/ui";
import { DEFAULT_WEIGHTS, type SolverStatus } from "@/engine";
import { downloadText } from "@/lib/solver/download-text";
import { useSolver } from "@/lib/solver/use-solver";
import { useData } from "@/lib/store/data-context";

interface Row {
  algorithm: "heuristic" | "ga" | "tabu";
  seed: number;
  status: SolverStatus | "error";
  elapsedMs: number;
  hard: number;
  soft: number;
  iterations: number;
}

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function CompareRunner() {
  const { dataset } = useData();
  const { run, cancel } = useSolver();
  const [seeds, setSeeds] = useState(5);
  const [timeSec, setTimeSec] = useState(5);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState("");
  const stop = useRef(false);

  const start = async () => {
    setBusy(true);
    setRows([]);
    stop.current = false;
    const out: Row[] = [];
    for (const algorithm of ["heuristic", "ga", "tabu"] as const) {
      for (let seed = 1; seed <= seeds; seed++) {
        if (stop.current) break;
        setCurrent(`${algorithm} seed ${seed}`);
        const job = await run(dataset, { algorithm, seed, timeLimitMs: timeSec * 1000, weights: DEFAULT_WEIGHTS });
        const r = job.result;
        out.push({
          algorithm,
          seed,
          status: r?.status ?? "error",
          elapsedMs: r?.stats.elapsedMs ?? 0,
          hard: r?.score.hard ?? NaN,
          soft: r?.score.soft ?? NaN,
          iterations: r?.stats.iterations ?? 0,
        });
        setRows([...out]);
      }
    }
    setCurrent("");
    setBusy(false);
  };

  const summary = (["heuristic", "ga", "tabu"] as const).map((a) => {
    const rs = rows.filter((r) => r.algorithm === a);
    const ok = rs.filter((r) => r.hard === 0);
    const softs = ok.map((r) => r.soft);
    const mean = softs.length ? softs.reduce((s, x) => s + x, 0) / softs.length : NaN;
    const sd = softs.length > 1 ? Math.sqrt(softs.reduce((s, x) => s + (x - mean) ** 2, 0) / (softs.length - 1)) : NaN;
    return { a, runs: rs.length, success: ok.length, medianMs: median(rs.map((r) => r.elapsedMs)), mean, sd, minHard: rs.length ? Math.min(...rs.map((r) => r.hard)) : NaN };
  });

  const csv = () => {
    const head = "algorithm,seed,status,elapsedMs,hard,soft,iterations";
    const body = rows.map((r) => [r.algorithm, r.seed, r.status, r.elapsedMs, r.hard, r.soft.toFixed(3), r.iterations].join(","));
    downloadText([head, ...body].join("\n"), `compare-${dataset.term.year}-${dataset.term.term}-${Date.now()}.csv`, "text/csv");
  };

  const fmt = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "—");

  return (
    <div className="flex flex-col gap-4">
      <Card title="ตั้งค่าการเปรียบเทียบ">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="จำนวน seed ต่ออัลกอริทึม">
            {(id) => <Input id={id} type="number" min={1} max={20} value={seeds} onChange={(e) => setSeeds(Math.max(1, Number(e.target.value) || 1))} disabled={busy} className="w-32" />}
          </Field>
          <Field label="เวลาต่อการรัน (วินาที)">
            {(id) => <Input id={id} type="number" min={1} max={120} value={timeSec} onChange={(e) => setTimeSec(Math.max(1, Number(e.target.value) || 1))} disabled={busy} className="w-32" />}
          </Field>
          {!busy ? (
            <Button variant="primary" onClick={start}>
              เริ่มเปรียบเทียบ ({seeds * 3} การรัน)
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() => {
                stop.current = true;
                cancel();
              }}
            >
              หยุด
            </Button>
          )}
          {rows.length > 0 && !busy && <Button onClick={csv}>ดาวน์โหลด CSV</Button>}
        </div>
        <p className="mt-3 text-sm text-muted">
          รัน seed 1..N ด้วยเวลาเท่ากัน บนข้อมูลปัจจุบัน ในเครื่องนี้ — ผลขึ้นกับความเร็วเครื่อง {busy && current && <span className="text-accent">· กำลังรัน {current}</span>}
        </p>
      </Card>

      {rows.length > 0 && (
        <>
          <Card title="สรุป (เฉพาะผลที่รันจริงในหน้านี้)">
            <DataTable>
              <thead>
                <tr>
                  <th>อัลกอริทึม</th>
                  <th>จำนวนรัน</th>
                  <th>สำเร็จ (Hard = 0)</th>
                  <th>Hard ต่ำสุด</th>
                  <th>เวลามัธยฐาน (วินาที)</th>
                  <th>Soft เฉลี่ย ± SD (เฉพาะที่สำเร็จ)</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.a}>
                    <td className="font-medium">{s.a === "ga" ? "Genetic Algorithm" : "Heuristic baseline"}</td>
                    <td className="tabular-nums">{s.runs}</td>
                    <td className="tabular-nums">
                      {s.success}/{s.runs}
                    </td>
                    <td className="tabular-nums">{fmt(s.minHard, 0)}</td>
                    <td className="tabular-nums">{fmt(s.medianMs / 1000, 2)}</td>
                    <td className="tabular-nums">
                      {fmt(s.mean)} ± {fmt(s.sd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </Card>
          <Card title="ผลรายการรัน">
            <DataTable>
              <thead>
                <tr>
                  <th>อัลกอริทึม</th>
                  <th>seed</th>
                  <th>สถานะ</th>
                  <th>เวลา (วินาที)</th>
                  <th>รอบคำนวณ</th>
                  <th>Hard</th>
                  <th>Soft</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.algorithm}</td>
                    <td className="tabular-nums">{r.seed}</td>
                    <td>{r.status}</td>
                    <td className="tabular-nums">{(r.elapsedMs / 1000).toFixed(2)}</td>
                    <td className="tabular-nums">{r.iterations.toLocaleString()}</td>
                    <td className={`tabular-nums ${r.hard === 0 ? "text-ok" : "text-danger"}`}>{r.hard}</td>
                    <td className="tabular-nums">{fmt(r.soft)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </Card>
        </>
      )}
      {rows.length === 0 && !busy && <Alert tone="accent">กด &ldquo;เริ่มเปรียบเทียบ&rdquo; เพื่อรัน baseline และ GA ด้วย seed เดียวกันแล้วเทียบเวลา ข้อขัดแย้ง และคะแนน Soft</Alert>}
    </div>
  );
}
