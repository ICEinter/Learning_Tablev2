/**
 * ตัวควบคุมการทำงาน: deadline, ยกเลิก, yield ให้ event loop, progress (throttle)
 */
import type { ProgressEvent, SolveHooks } from "./types";

const YIELD_MS = 40;
const PROGRESS_MS = 250;

export class Ctl {
  readonly t0: number;
  deadline: number;
  private lastYield: number;
  private lastProgress = -Infinity;
  private hooks?: SolveHooks;

  constructor(t0: number, deadline: number, hooks?: SolveHooks) {
    this.t0 = t0;
    this.deadline = deadline;
    this.lastYield = now();
    this.hooks = hooks;
  }

  /** ตัวควบคุมลูก: deadline ไม่เกินของแม่ ใช้ signal/progress ร่วมกัน */
  child(deadline: number): Ctl {
    const c = new Ctl(this.t0, Math.min(deadline, this.deadline), this.hooks);
    return c;
  }

  get cancelled(): boolean {
    return Boolean(this.hooks?.signal?.cancelled);
  }

  timeUp(): boolean {
    return now() >= this.deadline;
  }

  shouldStop(): boolean {
    return this.cancelled || this.timeUp();
  }

  elapsed(): number {
    return now() - this.t0;
  }

  /** yield ทุก ~40ms (ไม่ส่งผลต่อผลลัพธ์ จึงคง determinism) */
  async maybeYield(): Promise<void> {
    const t = now();
    if (t - this.lastYield >= YIELD_MS) {
      await new Promise<void>((r) => setTimeout(r, 0));
      this.lastYield = now();
    }
  }

  progress(e: Omit<ProgressEvent, "elapsedMs">, force = false): void {
    const cb = this.hooks?.onProgress;
    if (!cb) return;
    const t = now();
    if (!force && t - this.lastProgress < PROGRESS_MS) return;
    this.lastProgress = t;
    try {
      cb({ ...e, elapsedMs: Math.round(t - this.t0) });
    } catch {
      // ไม่ให้ error ของผู้ฟังทำให้ solver ล้ม
    }
  }
}

export function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}
