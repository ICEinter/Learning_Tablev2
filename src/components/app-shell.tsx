"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/auth/session-context";
import { useData } from "@/lib/store/data-context";
import type { Role } from "@/shared/types";
import { Icon, type IconName } from "./icons";
import { Badge, Button, Spinner, cx } from "./ui";

export const NAV: Record<Role, { href: string; label: string; icon: IconName }[]> = {
  admin: [
    { href: "/admin", label: "แดชบอร์ด", icon: "dashboard" },
    { href: "/admin/setup", label: "ตั้งค่าปี/ภาค/เวลา", icon: "settings" },
    { href: "/admin/data", label: "ข้อมูลหลัก", icon: "database" },
    { href: "/admin/import", label: "นำเข้าข้อมูล", icon: "upload" },
    { href: "/admin/solve", label: "จัดตารางอัตโนมัติ", icon: "spark" },
    { href: "/admin/timetables", label: "ตารางเรียน/สอน", icon: "calendar" },
    { href: "/admin/reports", label: "รายงาน", icon: "report" },
    { href: "/admin/users", label: "ผู้ใช้และสิทธิ์", icon: "users" },
    { href: "/admin/help", label: "วิธีใช้งาน", icon: "help" },
  ],
  teacher: [
    { href: "/teacher", label: "ตารางสอนของฉัน", icon: "calendar" },
    { href: "/teacher/help", label: "วิธีใช้งาน", icon: "help" },
  ],
  student: [
    { href: "/student", label: "ตารางเรียนของฉัน", icon: "calendar" },
    { href: "/student/help", label: "วิธีใช้งาน", icon: "help" },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  teacher: "ครูผู้สอน",
  student: "นักเรียน/นักศึกษา",
};

/** ป้องกันหน้าตามบทบาท (ฝั่ง UI) — ข้อมูลจริงป้องกันด้วย Security Rules และ API ฝั่ง server */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { ready, session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) router.replace("/");
  }, [ready, session, router]);

  if (!ready || !session)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <Spinner />
      </div>
    );

  if (!roles.includes(session.role))
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="font-semibold text-lg text-ink">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <p className="mt-2 text-sm text-muted">บทบาทของคุณคือ {ROLE_LABEL[session.role]}</p>
        <Link className="mt-4 inline-block text-accent underline font-medium" href={NAV[session.role][0].href}>
          ไปหน้าหลักของฉัน
        </Link>
      </div>
    );

  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut, mode: authMode } = useSession();
  const { dataset, mode, ready, error, timetables } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const nav = session ? NAV[session.role] : [];

  const publishedTimetable = timetables.find((t) => t.status === "published");

  return (
    <div className="min-h-screen bg-page flex flex-col pb-16 lg:pb-0">
      {/* Header Bar */}
      <header className="no-print sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <button
            className="rounded-lg p-2 text-muted hover:bg-page hover:text-ink lg:hidden transition-colors"
            aria-label="เปิดเมนู"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <Link href="/" className="flex items-center gap-2.5 font-bold transition-opacity hover:opacity-90">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm text-white shadow-xs font-bold">
              LT
            </span>
            <span className="hidden sm:inline text-ink font-bold tracking-tight">Learning Table</span>
          </Link>

          <div className="hidden min-w-0 flex-1 truncate text-xs text-muted md:block pl-2 border-l border-line ml-1">
            <span className="font-medium text-ink">{dataset.school.name || "สถานศึกษา"}</span> · ภาคเรียน {dataset.term.term}/{dataset.term.year}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Badge tone={mode === "firebase" ? "ok" : "warn"}>
              {mode === "firebase" ? "Firebase Cloud" : "โหมดสาธิต (Demo)"}
            </Badge>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-lg p-2 text-muted hover:bg-page hover:text-ink transition-colors"
                title="การแจ้งเตือน"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {publishedTimetable && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-ok animate-pulse" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-line bg-surface p-4 shadow-lg z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-line mb-3">
                    <span className="text-xs font-bold text-ink">การแจ้งเตือน</span>
                    <button onClick={() => setNotifOpen(false)} className="text-muted hover:text-ink text-xs">ปิด</button>
                  </div>
                  {publishedTimetable ? (
                    <div className="rounded-lg bg-ok-soft p-2.5 text-xs text-ok">
                      <p className="font-semibold">ตารางเรียน/สอนฉบับเผยแพร่</p>
                      <p className="text-[11px] mt-0.5 text-muted">
                        เวอร์ชัน {publishedTimetable.label} เผยแพร่แล้ว ครูและนักเรียนสามารถดูตารางได้
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted text-center py-2">ไม่มีการแจ้งเตือนใหม่</p>
                  )}
                </div>
              )}
            </div>

            {session && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setProfileModal(true)}
                  className="flex items-center gap-2 rounded-lg py-1 px-2 hover:bg-page transition-colors text-left"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                    {session.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-36 truncate text-xs font-medium text-ink sm:inline" title={session.displayName}>
                    {session.displayName}
                  </span>
                </button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await signOut();
                    router.replace("/");
                  }}
                  title="ออกจากระบบ"
                >
                  <Icon name="logout" size={16} />
                  <span className="hidden md:inline">ออกจากระบบ</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        {/* Desktop Sidebar */}
        <nav
          aria-label="เมนูหลัก"
          className={cx(
            "no-print fixed inset-y-14 left-0 z-30 w-64 shrink-0 border-r border-line bg-surface p-3 transition-transform lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 overflow-y-auto",
            open ? "translate-x-0 shadow-xl" : "-translate-x-full",
          )}
        >
          <div className="mb-3 px-3 py-2 rounded-lg bg-page/70 text-xs">
            <span className="block font-semibold text-ink">{dataset.school.name}</span>
            <span className="block text-[11px] text-muted">บทบาท: {session ? ROLE_LABEL[session.role] : "ทั่วไป"}</span>
          </div>

          <ul className="flex flex-col gap-1">
            {nav.map((item) => {
              const root = item.href === "/admin" || item.href === "/teacher" || item.href === "/student";
              const active = item.href === pathname || (!root && pathname.startsWith(item.href + "/"));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all",
                      active
                        ? "bg-accent-soft font-semibold text-accent shadow-2xs"
                        : "text-ink hover:bg-page hover:text-accent",
                    )}
                  >
                    <Icon name={item.icon} className={active ? "text-accent" : "text-muted"} size={18} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 border-t border-line pt-4 px-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs text-muted hover:text-accent transition-colors"
            >
              <span>← ไปหน้าแรก (Landing Page)</span>
            </Link>
          </div>
        </nav>

        {open && (
          <div
            className="no-print fixed inset-0 top-14 z-20 bg-black/30 backdrop-blur-xs lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Content Area */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          {error && (
            <div className="mb-5 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger flex items-start gap-2 shadow-2xs">
              <Icon name="shield" size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}
          {ready ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-muted gap-3">
              <Spinner />
              <p className="text-sm">กำลังโหลดข้อมูลระบบ...</p>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {session && (
        <div className="lg:hidden no-print fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md px-2 py-1 flex items-center justify-around">
          {nav.slice(0, 4).map((item) => {
            const root = item.href === "/admin" || item.href === "/teacher" || item.href === "/student";
            const active = item.href === pathname || (!root && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-muted hover:text-ink",
                )}
              >
                <Icon name={item.icon} size={20} className={active ? "text-accent" : "text-muted"} />
                <span className="truncate max-w-[64px]">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setProfileModal(true)}
            className="flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium text-muted hover:text-ink"
          >
            <Icon name="user" size={20} />
            <span>โปรไฟล์</span>
          </button>
        </div>
      )}

      {/* User Profile Modal */}
      {profileModal && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl border border-line">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <h3 className="text-base font-bold text-ink">ข้อมูลผู้ใช้งาน</h3>
              <button
                type="button"
                onClick={() => setProfileModal(false)}
                className="text-muted hover:text-ink text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center text-center mb-5">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent mb-2">
                {session.displayName.slice(0, 1).toUpperCase()}
              </span>
              <h4 className="text-base font-bold text-ink">{session.displayName}</h4>
              <span className="mt-1 inline-block rounded-full bg-page px-3 py-1 text-xs font-semibold text-accent">
                {ROLE_LABEL[session.role]}
              </span>
            </div>

            <div className="flex flex-col gap-2 rounded-xl bg-page p-3 text-xs mb-5 border border-line">
              <div className="flex justify-between">
                <span className="text-muted">รหัสผู้ใช้ (UID):</span>
                <span className="font-mono text-ink truncate max-w-[160px]">{session.uid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">สถานศึกษา:</span>
                <span className="font-medium text-ink">{dataset.school.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">โหมดการทำงาน:</span>
                <span className="font-medium text-ink">{authMode === "firebase" ? "Firebase Authentication" : "สาธิต (Demo)"}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setProfileModal(false)}>
                ปิดหน้าต่าง
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setProfileModal(false);
                  await signOut();
                  router.replace("/login");
                }}
              >
                ออกจากระบบ
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
