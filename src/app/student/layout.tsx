import type { ReactNode } from "react";
import { AppShell, RequireRole } from "@/components/app-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RequireRole roles={["student"]}>
      <AppShell>{children}</AppShell>
    </RequireRole>
  );
}
