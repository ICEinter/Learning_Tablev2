/**
 * Public API ของ engine — ใช้ได้ทั้ง Node (test/bench) และ Web Worker
 */
export * from "./types";
export { validate } from "./validator";
export { precheck } from "./precheck";
export { solve } from "./solve";
export { runTabuSearch } from "./tabu";
export { moveTargets, evaluateMove } from "./moves";
export type { MoveTarget } from "./moves";
