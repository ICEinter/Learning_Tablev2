/** ดาวน์โหลดข้อความเป็นไฟล์ (เพิ่ม BOM เพื่อให้ Excel อ่านภาษาไทยได้ถูกต้อง) */
export function downloadText(text: string, fileName: string, mime = "text/plain"): void {
  const blob = new Blob(["\uFEFF" + text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
