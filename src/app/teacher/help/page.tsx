"use client";
import { HelpContent } from "@/components/help/help-content";
import { PageHeader } from "@/components/ui";

export default function HelpPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="วิธีใช้งาน" description="คู่มือการใช้งานระบบจัดตารางการเรียนการสอนแบบทีละขั้นตอน" />
      <HelpContent role="teacher" />
    </div>
  );
}
