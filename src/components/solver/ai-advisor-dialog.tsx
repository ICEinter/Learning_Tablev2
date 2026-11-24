"use client";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import type { SolverResult } from "@/engine";
import type { AIAdvisorResponse } from "@/app/api/ai/advisor/route";

export function AIAdvisorDialog({
  result,
  isOpen,
  onClose,
}: {
  result: SolverResult;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AIAdvisorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAdvice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm: result.stats.algorithm,
          seed: result.stats.seed,
          hard: result.score.hard,
          soft: result.score.soft,
          elapsedMs: result.stats.elapsedMs,
          placementsCount: result.placements.length,
          breakdown: result.score.breakdown,
          explanations: result.explanation,
        }),
      });
      if (!res.ok) throw new Error("ไม่สามารถเชื่อมต่อ AI Advisor ได้");
      const json: AIAdvisorResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-lg">
              🧠
            </span>
            <div>
              <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                AI Scheduling Copilot & Advisor
                {data && (
                  <Badge tone={data.source === "openrouter" ? "ok" : "warn"}>
                    {data.source === "openrouter" ? "✨ ขับเคลื่อนด้วย OpenRouter" : "⚙️ In-Engine Rule-based"}
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                วิเคราะห์เชิงบริหาร ให้คำแนะนำกลยุทธ์ และประเมินความเสี่ยงของตาราง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!data && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-4xl mb-3">📊</span>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                พร้อมวิเคราะห์ผลลัพธ์การจัดตาราง
              </h3>
              <p className="text-xs text-slate-500 max-w-md mb-5">
                AI จะประเมินตัวชี้วัด Soft Score, คาบว่างคั่น, การย้ายห้องเรียน และเสนอแนะแนวทางปรับปรุงเชิงวิชาการ
              </p>
              <Button variant="primary" onClick={fetchAdvice}>
                🚀 เริ่มการวิเคราะห์ด้วย AI
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-500 border-t-transparent mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                AI กำลังประมวลผลและวิเคราะห์ตารางสอน...
              </p>
              <p className="text-xs text-slate-400 mt-1">
                (หากออฟไลน์หรือไม่มี Key ระบบจะสลับสู่ Rule-based อัตโนมัติ)
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {/* Executive Summary */}
              <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 dark:border-purple-900/30 dark:bg-purple-950/20">
                <h4 className="font-semibold text-xs text-purple-900 dark:text-purple-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  📌 บทสรุปเชิงบริหาร (Executive Summary)
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {data.executiveSummary}
                </p>
              </div>

              {/* Strengths */}
              <div>
                <h4 className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  ✅ จุดเด่นของตารางนี้ (Strengths)
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {data.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg bg-emerald-500/5 p-2.5 border border-emerald-500/20">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div>
                <h4 className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  💡 ข้อเสนอแนะเชิงกลยุทธ์ (Strategic Recommendations)
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {data.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg bg-blue-500/5 p-2.5 border border-blue-500/20">
                      <span className="text-blue-500 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risk Assessment */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  ⚠️ การประเมินความเสี่ยง (Risk Assessment)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {data.riskAssessment}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 rounded-b-2xl">
          <span className="text-[11px] text-slate-400">
            ระบบจัดตารางเรียนตารางสอน V2 · แผนกเทคโนโลยีสารสนเทศ วท.ระยอง
          </span>
          <div className="flex gap-2">
            {data && (
              <Button size="sm" variant="secondary" onClick={fetchAdvice} disabled={loading}>
                🔄 วิเคราะห์ซ้ำ
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={onClose}>
              ปิดหน้าต่าง
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

