/** สร้าง id ใหม่ (ไม่ใช้เป็นข้อมูลลับ) เช่น newId("c") -> "c-lq3k9x-4f2a" */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}${rand.slice(0, 6)}`;
}
