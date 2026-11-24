"use client";
import Link from "next/link";
import { HelpContent } from "@/components/help/help-content";

/** คู่มือสาธารณะ (เปิดได้โดยไม่ต้องเข้าสู่ระบบ) */
export default function GuidePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/login" className="text-sm text-accent underline underline-offset-2">
            ← กลับหน้าเข้าสู่ระบบ
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">วิธีใช้งาน Learning Table</h1>
          <p className="mt-1 text-sm text-muted">คู่มือทีละขั้นตอนสำหรับผู้ดูแลระบบ ครู และนักเรียน</p>
        </div>
      </div>
      <HelpContent role="admin" showAll linkable={false} />
    </main>
  );
}
