"use client";
/**
 * useSolver — ควบคุมงานคำนวณใน Web Worker (ไม่บล็อก UI)
 * รองรับ: สถานะ, ความคืบหน้า, ยกเลิก, เริ่มใหม่ และรันหลายงานต่อเนื่อง (เปรียบเทียบอัลกอริทึม)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProgressEvent, SolverOptions, SolverResult, WorkerIn, WorkerOut } from "@/engine/types";
import type { Dataset } from "@/shared/types";

export type JobState = "idle" | "running" | "done" | "cancelled" | "error";

export interface SolverJob {
  id: string;
  options: SolverOptions;
  state: JobState;
  startedAt: number;
  finishedAt?: number;
  progress: ProgressEvent[];
  result?: SolverResult;
  error?: string;
}

function createWorker(): Worker {
  return new Worker(new URL("../../workers/solver.worker.ts", import.meta.url), { type: "module" });
}

export function useSolver() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<string, { resolve: (j: SolverJob) => void }>());
  const [job, setJob] = useState<SolverJob | null>(null);
  const jobRef = useRef<SolverJob | null>(null);

  const update = useCallback((fn: (j: SolverJob) => SolverJob) => {
    if (!jobRef.current) return;
    jobRef.current = fn(jobRef.current);
    setJob(jobRef.current);
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = createWorker();
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const msg = e.data;
      if (!jobRef.current || msg.id !== jobRef.current.id) return;
      if (msg.type === "progress") {
        update((j) => {
          const progress = j.progress.length > 400 ? [...j.progress.filter((_, i) => i % 2 === 0), msg.event] : [...j.progress, msg.event];
          return { ...j, progress };
        });
      } else if (msg.type === "result") {
        update((j) => ({ ...j, state: msg.result.status === "cancelled" ? "cancelled" : "done", result: msg.result, finishedAt: Date.now() }));
        pending.current.get(msg.id)?.resolve(jobRef.current!);
        pending.current.delete(msg.id);
      } else if (msg.type === "error") {
        update((j) => ({ ...j, state: "error", error: msg.message, finishedAt: Date.now() }));
        pending.current.get(msg.id)?.resolve(jobRef.current!);
        pending.current.delete(msg.id);
      }
    };
    w.onerror = (e) => {
      update((j) => ({ ...j, state: "error", error: e.message || "Worker ทำงานผิดพลาด", finishedAt: Date.now() }));
      if (jobRef.current) {
        pending.current.get(jobRef.current.id)?.resolve(jobRef.current);
        pending.current.delete(jobRef.current.id);
      }
    };
    workerRef.current = w;
    return w;
  }, [update]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  /** เริ่มงานใหม่ — คืน Promise ที่ resolve เมื่องานจบ (สำเร็จ/ยกเลิก/ผิดพลาด) */
  const run = useCallback(
    (dataset: Dataset, options: SolverOptions): Promise<SolverJob> => {
      const id = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const j: SolverJob = { id, options, state: "running", startedAt: Date.now(), progress: [] };
      jobRef.current = j;
      setJob(j);
      const w = ensureWorker();
      return new Promise<SolverJob>((resolve) => {
        pending.current.set(id, { resolve });
        const msg: WorkerIn = { type: "solve", id, dataset, options };
        w.postMessage(msg);
      });
    },
    [ensureWorker],
  );

  /** ยกเลิกแบบร่วมมือ (solver คืนผลดีที่สุดที่หาได้) — ถ้าไม่ตอบใน 3 วินาทีจะ terminate worker */
  const cancel = useCallback(() => {
    const j = jobRef.current;
    const w = workerRef.current;
    if (!j || j.state !== "running" || !w) return;
    const msg: WorkerIn = { type: "cancel", id: j.id };
    w.postMessage(msg);
    const id = j.id;
    setTimeout(() => {
      if (jobRef.current?.id === id && jobRef.current.state === "running") {
        w.terminate();
        workerRef.current = null;
        update((x) => ({ ...x, state: "cancelled", error: "หยุด worker แบบบังคับ (ไม่ได้รับผลลัพธ์)", finishedAt: Date.now() }));
        pending.current.get(id)?.resolve(jobRef.current!);
        pending.current.delete(id);
      }
    }, 3000);
  }, [update]);

  const reset = useCallback(() => {
    jobRef.current = null;
    setJob(null);
  }, []);

  return { job, run, cancel, reset };
}
