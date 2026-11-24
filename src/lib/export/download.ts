/** ดาวน์โหลด Blob เป็นไฟล์ (ฝั่งเบราว์เซอร์เท่านั้น) */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("downloadBlob ใช้ได้เฉพาะในเบราว์เซอร์");
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // เผื่อเวลาให้เบราว์เซอร์เริ่มดาวน์โหลดก่อนคืนหน่วยความจำ
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** ตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้ */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim() || "export";
}
