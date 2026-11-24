/// <reference lib="webworker" />
/**
 * Web Worker สำหรับจัดตาราง — รับ WorkerIn, ส่ง WorkerOut
 * 'solve' → เรียก solve() พร้อม signal, 'cancel' → ตั้ง signal.cancelled = true
 */
import { solve, type WorkerIn, type WorkerOut } from "@/engine";

declare const self: DedicatedWorkerGlobalScope;

const signals = new Map<string, { cancelled: boolean }>();

function post(msg: WorkerOut): void {
  self.postMessage(msg);
}

self.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if (msg.type === "cancel") {
    const s = signals.get(msg.id);
    if (s) s.cancelled = true;
    return;
  }
  if (msg.type === "solve") {
    const signal = { cancelled: false };
    signals.set(msg.id, signal);
    try {
      const result = await solve(msg.dataset, msg.options, {
        signal,
        onProgress: (event) => post({ type: "progress", id: msg.id, event }),
      });
      post({ type: "result", id: msg.id, result });
    } catch (e) {
      post({ type: "error", id: msg.id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      signals.delete(msg.id);
    }
  }
};

export {};
