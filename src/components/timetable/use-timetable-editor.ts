"use client";
/**
 * สำเนาทำงานของตารางร่างพร้อม undo/redo
 * (รีเซ็ตอัตโนมัติเมื่อ placements ต้นฉบับเปลี่ยน เช่น หลังบันทึก)
 */
import { useCallback, useState } from "react";
import type { Placement } from "@/shared/types";

interface EditorState {
  base: Placement[];
  past: Placement[][];
  present: Placement[];
  future: Placement[][];
}

const init = (base: Placement[]): EditorState => ({ base, past: [], present: base, future: [] });

export interface MoveSpec {
  assignmentId: string;
  block: number;
  day: number;
  period: number;
  roomId: string;
}

export function applyMove(placements: Placement[], m: MoveSpec): Placement[] {
  return placements.map((p) =>
    p.assignmentId === m.assignmentId && p.block === m.block ? { ...p, day: m.day, period: m.period, roomId: m.roomId } : p,
  );
}

export function useTimetableEditor(original: Placement[]) {
  const [s, setS] = useState<EditorState>(() => init(original));
  // ปรับ state เมื่อ prop เปลี่ยน (รูปแบบที่ React แนะนำ แทน useEffect)
  let cur = s;
  if (s.base !== original) {
    cur = init(original);
    setS(cur);
  }

  const move = useCallback((m: MoveSpec) => {
    setS((x) => ({ ...x, past: [...x.past, x.present], present: applyMove(x.present, m), future: [] }));
  }, []);
  const undo = useCallback(() => {
    setS((x) => (x.past.length ? { ...x, past: x.past.slice(0, -1), present: x.past[x.past.length - 1], future: [x.present, ...x.future] } : x));
  }, []);
  const redo = useCallback(() => {
    setS((x) => (x.future.length ? { ...x, past: [...x.past, x.present], present: x.future[0], future: x.future.slice(1) } : x));
  }, []);
  const reset = useCallback(() => setS((x) => init(x.base)), []);

  return {
    placements: cur.present,
    dirty: cur.present !== cur.base,
    canUndo: cur.past.length > 0,
    canRedo: cur.future.length > 0,
    changes: cur.past.length,
    move,
    undo,
    redo,
    reset,
  };
}
