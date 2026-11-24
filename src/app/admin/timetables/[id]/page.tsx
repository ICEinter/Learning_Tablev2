"use client";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { TimetableDetail } from "./timetable-detail";

export default function TimetableDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-muted">
          <Spinner />
        </div>
      }
    >
      <TimetableDetail />
    </Suspense>
  );
}
