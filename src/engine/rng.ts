/**
 * ตัวสุ่มแบบกำหนด seed ได้ (mulberry32) — ทุกการสุ่มใน engine ต้องมาจากที่นี่
 * seed เดียวกัน ⇒ ลำดับตัวเลขเหมือนกันทุกครั้ง ทุกเครื่อง
 */

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** จำนวนเต็ม [0, n) */
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
  /** สร้าง rng ลูกที่เป็นอิสระแต่กำหนดได้ จาก label */
  fork(label: string | number): Rng;
  readonly seed: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** hash สตริง/ตัวเลข → uint32 (FNV-1a) */
export function hash32(x: string | number): number {
  const s = String(x);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function forkSeed(seed: number, label: string | number): number {
  return (hash32(`${seed >>> 0}:${label}`) ^ Math.imul(seed >>> 0, 0x9e3779b1)) >>> 0;
}

export function createRng(seed: number): Rng {
  const gen = mulberry32(seed);
  const rng: Rng = {
    seed: seed >>> 0,
    next: gen,
    int: (n: number) => (n <= 1 ? 0 : Math.floor(gen() * n)),
    pick<T>(arr: readonly T[]): T {
      return arr[rng.int(arr.length)];
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    },
    fork: (label: string | number) => createRng(forkSeed(seed, label)),
  };
  return rng;
}
