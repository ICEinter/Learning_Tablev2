import type { Session } from "@/shared/types";

const DEMO_SESSION_PREFIX = "demo-";

export function isDemoSession(session: Pick<Session, "uid"> | null | undefined): boolean {
  return Boolean(session?.uid.startsWith(DEMO_SESSION_PREFIX));
}

