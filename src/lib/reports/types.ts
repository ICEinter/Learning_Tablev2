/** โครงสร้างรายงานแบบตาราง — ใช้ร่วมกันระหว่างหน้าจอ, PDF และ Excel */
export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  numeric?: boolean;
  width?: number;
}

export interface ReportTable {
  id: string;
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  footnote?: string;
}
