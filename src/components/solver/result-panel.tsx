"use client";
import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, Button, Card, DataTable } from "@/components/ui";
import { SOFT_KEYS, SOFT_LABEL, STATUS_LABEL, type SolverResult } from "@/engine";
import { AIAdvisorDialog } from "./ai-advisor-dialog";

export function ResultPanel({ result, onSave, savedLink }: { result: SolverResult; onSave: () => void; savedLink?: string }) {
  const [showAll, setShowAll] = useState(false);
  const [showAiAdvisor, setShowAiAdvisor] = useState(false);
  const hard = result.violations.filter((v) => v.severity === "hard");
  const byType = new Map<string, number>();
  hard.forEach((v) => byType.set(v.type, (byType.get(v.type) ?? 0) + 1));
  const ok = result.status === "feasible";
  const canSave = result.placements.length > 0 && result.status !== "infeasible-proven";

  return (
    <>
      <Card
        title="ผลลัพธ์"
        actions={
          <div className="flex items-center gap-2">
            {canSave && (
              <Button size="sm" variant="secondary" onClick={() => setShowAiAdvisor(true)}>
                🧠 วิเคราะห์ด้วย AI
              </Button>
            )}
            {savedLink ? (
              <Link href={savedLink} className="text-sm font-medium text-accent underline">
                เปิดตารางที่บันทึก →
              </Link>
            ) : (
              canSave && (
                <Button size="sm" variant="primary" onClick={onSave}>
                  บันทึกเป็นฉบับร่าง
                </Button>
              )
            )}
          </div>
        }
      >
      <div className="flex flex-col gap-4">
        <Alert tone={ok ? "ok" : result.status === "infeasible-proven" ? "danger" : "warn"} title={STATUS_LABEL[result.status]}>
          อัลกอริทึม {result.stats.algorithm} · seed {result.stats.seed} · ใช้เวลา {(result.stats.elapsedMs / 1000).toFixed(2)} วินาที · {result.stats.iterations.toLocaleString()} รอบ
          {!ok && result.status !== "infeasible-proven" && result.placements.length > 0 && (
            <div className="mt-1">ผลนี้ยังมีข้อขัดแย้ง Hard — บันทึกเป็นร่างเพื่อแก้ไขเองได้ แต่จะเผยแพร่ไม่ได้จนกว่า Hard = 0</div>
          )}
        </Alert>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="ข้อขัดแย้ง Hard" value={result.score.hard} tone={result.score.hard === 0 ? "ok" : "danger"} />
          <Metric label="คะแนน Soft (ถ่วงน้ำหนัก)" value={Number(result.score.soft.toFixed(1))} />
          <Metric label="จำนวนคาบที่วาง (block)" value={result.placements.length} />
        </div>

        {result.proofs.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">หลักฐานความเป็นไปไม่ได้</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.proofs.map((p, i) => (
                <li key={i}>
                  <Badge tone="danger">{p.rule}</Badge> {p.message} (ต้องการ {p.required} / มี {p.available})
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.explanation.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">คำอธิบายผล (Agent)</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.explanation.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">คะแนน Soft แยกตามเงื่อนไข (ค่าดิบ)</h3>
            <DataTable>
              <tbody>
                {SOFT_KEYS.map((k) => (
                  <tr key={k}>
                    <td>{SOFT_LABEL[k]}</td>
                    <td className="text-right tabular-nums">{result.score.breakdown[k] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">ข้อขัดแย้ง Hard แยกตามประเภท</h3>
            {byType.size === 0 ? (
              <p className="text-sm text-ok">ไม่มีข้อขัดแย้ง Hard</p>
            ) : (
              <DataTable>
                <tbody>
                  {[...byType.entries()].map(([t, n]) => (
                    <tr key={t}>
                      <td>{t}</td>
                      <td className="text-right tabular-nums">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </div>
        </div>

        {hard.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">รายการข้อขัดแย้ง</h3>
            <ul className="space-y-1 text-sm">
              {(showAll ? hard : hard.slice(0, 10)).map((v, i) => (
                <li key={i} className="rounded border border-line px-3 py-1.5">
                  <Badge tone="danger">{v.type}</Badge> {v.message}
                </li>
              ))}
            </ul>
            {hard.length > 10 && (
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowAll((x) => !x)}>
                {showAll ? "แสดงน้อยลง" : `แสดงทั้งหมด ${hard.length} รายการ`}
              </Button>
            )}
          </div>
        )}

        {result.agentRounds && result.agentRounds.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">บันทึกการทำงานของ Agent (ทุกรอบ)</h3>
            <DataTable>
              <thead>
                <tr>
                  <th>รอบ</th>
                  <th>อัลกอริทึม</th>
                  <th>seed</th>
                  <th>เวลาที่ให้ (วินาที)</th>
                  <th>ใช้จริง (วินาที)</th>
                  <th>Hard</th>
                  <th>Soft</th>
                  <th>การตัดสินใจ</th>
                </tr>
              </thead>
              <tbody>
                {result.agentRounds.map((r) => (
                  <tr key={r.round}>
                    <td>{r.round}</td>
                    <td>{r.algorithm}</td>
                    <td className="tabular-nums">{r.seed}</td>
                    <td className="tabular-nums">{(r.timeLimitMs / 1000).toFixed(1)}</td>
                    <td className="tabular-nums">{(r.durationMs / 1000).toFixed(2)}</td>
                    <td className="tabular-nums">{r.hard}</td>
                    <td className="tabular-nums">{r.soft.toFixed(1)}</td>
                    <td className="min-w-64">{r.decision}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}

        {result.log.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Log ({result.log.length} บรรทัด)</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-page p-3 text-xs leading-relaxed">{result.log.join("\n")}</pre>
          </details>
        )}
      </div>
    </Card>
    <AIAdvisorDialog result={result} isOpen={showAiAdvisor} onClose={() => setShowAiAdvisor(false)} />
  </>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "danger" }) {
  return (
    <div className="rounded-md border border-line p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : ""}`}>{value.toLocaleString()}</div>
    </div>
  );
}
