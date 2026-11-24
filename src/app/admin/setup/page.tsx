"use client";
import { PageHeader, Spinner } from "@/components/ui";
import { useData } from "@/lib/store/data-context";
import { termLabel } from "@/shared/slots";
import { ResetSection } from "./_components/reset-section";
import { SchoolSection } from "./_components/school-section";
import { TermSection } from "./_components/term-section";
import { TimeSection } from "./_components/time-section";

export default function SetupPage() {
  const { dataset, ready } = useData();

  if (!ready)
    return (
      <div className="flex items-center gap-2 py-10 text-muted">
        <Spinner /> กำลังโหลดข้อมูล…
      </div>
    );

  return (
    <>
      <PageHeader title="ตั้งค่าสถานศึกษาและโครงสร้างเวลา" description={`ภาคเรียนปัจจุบัน ${termLabel(dataset)}`} />
      <div className="flex flex-col gap-5">
        {/* key = ค่าที่บันทึกล่าสุด: เมื่อข้อมูลเปลี่ยน (บันทึก/รีเซ็ต) ฟอร์มจะเริ่มจากค่าใหม่ */}
        <SchoolSection key={JSON.stringify(dataset.school)} initial={dataset.school} />
        <TermSection key={JSON.stringify(dataset.term)} initial={dataset.term} />
        <TimeSection key={JSON.stringify(dataset.time)} initial={dataset.time} />
        <ResetSection />
      </div>
    </>
  );
}
