"use client";
import type { ReactNode } from "react";
import { SessionProvider } from "@/lib/auth/session-context";
import { DataProvider } from "@/lib/store/data-context";
import { ToastProvider } from "@/components/ui";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <DataProvider>
        <ToastProvider>{children}</ToastProvider>
      </DataProvider>
    </SessionProvider>
  );
}
