"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NAV } from "@/components/app-shell";
import { Icon, type IconName } from "@/components/icons";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { createRayongDataset } from "@/data/rayong";
import { isDemoSession } from "@/lib/auth/demo-session";
import { useSession } from "@/lib/auth/session-context";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useData } from "@/lib/store/data-context";
import { teacherName } from "@/shared/slots";
import type { Dataset, Role, Session, Student, StudentGroup, Teacher } from "@/shared/types";

export default function LoginPage() {
  const { ready, session, signInDemo, signInEmail, signUp, resetPassword, signOut } = useSession();
  const { dataset } = useData();
  const router = useRouter();
  const firebaseConfigured = isFirebaseConfigured();
  const demoDataset = useMemo(() => createRayongDataset(), []);

  const [tab, setTab] = useState<"login" | "register">("login");
  const [activeMode, setActiveMode] = useState<"firebase" | "demo">("firebase");
  const [modeError, setModeError] = useState<string | null>(null);
  const demoActive = activeMode === "demo" || isDemoSession(session);

  const enterDemo = (demoSession: Session) => {
    signInDemo(demoSession);
    router.replace(NAV[demoSession.role]?.[0]?.href || "/");
  };

  const toggleDemo = async () => {
    setModeError(null);
    try {
      if (demoActive) {
        if (isDemoSession(session)) await signOut();
        setActiveMode("firebase");
      } else {
        setActiveMode("demo");
      }
    } catch {
      setModeError("ปิดโหมด Demo ไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "demo") {
      queueMicrotask(() => setActiveMode("demo"));
    }
  }, []);

  useEffect(() => {
    if (ready && session && !isDemoSession(session)) {
      const targetNav = NAV[session.role]?.[0]?.href || "/";
      router.replace(targetNav);
    }
  }, [ready, session, router]);

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ฝั่งซ้าย: Brand & Features Highlight */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-accent p-10 text-white lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "56px 40px",
          }}
        />
        <div className="relative flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-bold text-accent shadow-md">
              LT
            </span>
            <div>
              <span className="block text-xl font-bold tracking-tight">Learning Table</span>
              <span className="block text-xs text-white/75">ระบบจัดตารางการเรียนการสอน</span>
            </div>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            ระบบพร้อมใช้งาน
          </span>
        </div>

        <div className="relative my-8">
          <div className="inline-block rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold tracking-wide uppercase text-white mb-4">
            Next.js + Firebase Cloud Engine
          </div>
          <h1 className="text-3xl font-bold leading-tight xl:text-4xl text-white">
            จัดตารางการเรียนการสอน
            <br />
            <span className="text-white/90">ครบ จบ ในระบบเดียว</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/85">
            ตรวจจับข้อขัดแย้งอัตโนมัติ 100% รองรับครู ห้องเรียน กลุ่มเรียน และส่งออก PDF / Excel ตามแบบฟอร์มทางการ
          </p>
          <ul className="mt-8 grid max-w-md gap-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5 items-start">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <Icon name={f.icon} size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{f.title}</span>
                  <span className="block text-xs text-white/80 leading-normal">{f.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between pt-6 border-t border-white/20 text-xs text-white/70">
          <span>{dataset.school.name || demoDataset.school.name}</span>
          <Link href="/guide" className="hover:text-white transition-colors underline underline-offset-4">
            เอกสารคู่มือ & สถาปัตยกรรม
          </Link>
        </div>
      </section>

      {/* ฝั่งขวา: บัญชีปกติ หรือทดลองก่อนสมัคร */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8 bg-page">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="mb-6 lg:hidden flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow">
                LT
              </span>
              <div>
                <h1 className="text-lg font-bold text-ink">Learning Table</h1>
                <p className="text-xs text-muted">ระบบจัดตารางการเรียนการสอน</p>
              </div>
            </Link>
            <Link href="/guide" className="text-xs text-accent underline">
              คู่มือ
            </Link>
          </div>

          {/* Demo on/off switch */}
          <div className="mb-5 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-xs">
            <div>
              <p className="text-sm font-semibold text-ink">โหมดทดลอง Demo</p>
              <p className="text-xs text-muted">
                {demoActive ? "เปิด · ใช้ข้อมูลสังเคราะห์" : "ปิด · เข้าสู่ระบบหรือสมัครสมาชิกปกติ"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={demoActive}
              aria-label={demoActive ? "ปิดโหมด Demo" : "เปิดโหมด Demo"}
              onClick={() => void toggleDemo()}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${demoActive ? "bg-accent" : "bg-gray-300"
                }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${demoActive ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>
          {modeError && <Alert tone="danger">{modeError}</Alert>}

          {!demoActive ? (
            <div>
              {!firebaseConfigured && (
                <Alert tone="warn" title="บัญชีปกติยังไม่ได้เชื่อม Firebase">
                  เข้าสู่ระบบและสมัครสมาชิกต้องใช้การตั้งค่า Firebase จริงใน <code>.env.local</code> (ดู docs/DEPLOY.md)
                  หากต้องการลองระบบก่อน สามารถเลือก “ทดลองก่อนสมัคร (Demo)” ได้
                </Alert>
              )}

              {/* Tab Selector: Login vs Register */}
              <div className="mb-5 flex border-b border-line">
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className={`pb-3 text-base font-semibold transition-colors relative flex-1 text-center ${tab === "login" ? "text-accent" : "text-muted hover:text-ink"
                    }`}
                >
                  เข้าสู่ระบบ
                  {tab === "login" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className={`pb-3 text-base font-semibold transition-colors relative flex-1 text-center ${tab === "register" ? "text-accent" : "text-muted hover:text-ink"
                    }`}
                >
                  สมัครสมาชิกใหม่
                  {tab === "register" && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
                  )}
                </button>
              </div>

              {tab === "login" ? (
                <EmailLoginForm
                  onSubmit={signInEmail}
                  onResetPassword={resetPassword}
                  onSwitchRegister={() => setTab("register")}
                />
              ) : (
                <RegisterForm
                  onSubmit={signUp}
                  onSuccess={() => setTab("login")}
                  onSwitchLogin={() => setTab("login")}
                />
              )}
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-ink">โหมดทดลองใช้งาน</h2>
                <p className="mt-1 text-xs text-muted">
                  ลองระบบด้วยข้อมูลสังเคราะห์ก่อนตัดสินใจสมัคร ข้อมูลทดลองเก็บแยกจากบัญชีจริง
                </p>
              </div>
              <DemoLogin dataset={demoDataset} onPick={enterDemo} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "spark", title: "จัดตารางอัตโนมัติด้วย AI & GA", desc: "อัลกอริทึม Heuristic, Genetic Algorithm และ Agent ตรวจซ้ำ" },
  { icon: "shield", title: "ไม่ละเมิดเงื่อนไขบังคับ 100%", desc: "ตรวจการชนของครู ห้อง กลุ่มเรียน และนักเรียนทุกครั้งก่อนบันทึก" },
  { icon: "calendar", title: "มุมมองครบทุกกลุ่มผู้ใช้", desc: "ตารางครู ห้อง กลุ่มเรียน นักเรียน และรายวิชา สลับดูได้ทันที" },
  { icon: "file", title: "ส่งออก PDF & Excel ถูกต้องสมบูรณ์", desc: "ภาษาไทยครบถ้วน สระไม่ลอย A4 แนวนอน พร้อมพิมพ์" },
];

/* ---------------- Form เข้าสู่ระบบ ---------------- */
function EmailLoginForm({
  onSubmit,
  onResetPassword,
  onSwitchRegister,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onSwitchRegister: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await onSubmit(email.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมลและรหัสผ่าน");
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetBusy(true);
    try {
      await onResetPassword(resetEmail.trim());
      setSuccess(`ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง ${resetEmail} เรียบร้อยแล้ว`);
      setResetModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {success && <Alert tone="ok">{success}</Alert>}

        <Field label="อีเมล" required>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="username"
              placeholder="example@school.ac.th"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
        </Field>

        <Field label="รหัสผ่าน" required>
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="กรอกรหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-1"
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
              </button>
            </div>
          )}
        </Field>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setResetEmail(email);
              setResetModal(true);
            }}
            className="text-accent hover:underline font-medium"
          >
            ลืมรหัสผ่าน?
          </button>
          <button
            type="button"
            onClick={onSwitchRegister}
            className="text-muted hover:text-accent font-medium transition-colors"
          >
            ยังไม่มีบัญชี? <span className="text-accent underline">สมัครสมาชิก</span>
          </button>
        </div>

        <Button type="submit" variant="primary" loading={busy} className="mt-2 w-full py-2.5">
          เข้าสู่ระบบ
        </Button>
      </form>

      {/* Forgot Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl border border-line">
            <h3 className="text-lg font-bold text-ink">รีเซ็ตรหัสผ่าน</h3>
            <p className="mt-1 text-xs text-muted">
              ป้อนอีเมลที่ลงทะเบียนไว้ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้ทางอีเมล
            </p>
            <form onSubmit={handleResetPassword} className="mt-4 flex flex-col gap-3">
              <Input
                type="email"
                placeholder="กรอกอีเมลของคุณ"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
              <div className="flex gap-2 justify-end mt-2">
                <Button type="button" variant="secondary" onClick={() => setResetModal(false)}>
                  ยกเลิก
                </Button>
                <Button type="submit" variant="primary" loading={resetBusy}>
                  ส่งลิงก์รีเซ็ต
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Form สมัครสมาชิก ---------------- */
function RegisterForm({
  onSubmit,
  onSuccess,
  onSwitchLogin,
}: {
  onSubmit: (
    email: string,
    password: string,
    displayName: string,
    role: Role,
    meta?: { teacherId?: string; studentId?: string; groupIds?: string[] },
  ) => Promise<void>;
  onSuccess: () => void;
  onSwitchLogin: () => void;
}) {
  const router = useRouter();
  const { dataset } = useData();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("teacher");
  const [teacherId, setTeacherId] = useState(dataset.teachers[0]?.id ?? "");
  const [studentId, setStudentId] = useState(dataset.students[0]?.id ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const teachers = useMemo(() => [...dataset.teachers].sort((a, b) => a.code.localeCompare(b.code)), [dataset.teachers]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setBusy(true);
    try {
      const meta: { teacherId?: string; studentId?: string; groupIds?: string[] } = {};
      if (role === "teacher" && teacherId) {
        meta.teacherId = teacherId;
      } else if (role === "student" && studentId) {
        meta.studentId = studentId;
        const student = dataset.students.find((s) => s.id === studentId);
        if (student?.groupId) meta.groupIds = [student.groupId];
      }

      await onSubmit(email.trim(), password, displayName.trim(), role, meta);
      setSuccess("สมัครสมาชิกสำเร็จเรียบร้อย! กำลังนำท่านเข้าสู่ระบบ...");
      setTimeout(() => {
        router.replace(NAV[role]?.[0]?.href || "/admin");
      }, 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "สมัครสมาชิกไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {success && <Alert tone="ok">{success}</Alert>}

        <Field label="ชื่อ-นามสกุล / ชื่อที่แสดง" required>
          {(id) => (
            <Input
              id={id}
              type="text"
              placeholder="เช่น อ.สมชาย ใจดี หรือ นายสมศักดิ์ รักเรียน"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
        </Field>

        <Field label="อีเมลสำหรับเข้าสู่ระบบ" required>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="username"
              placeholder="user@school.ac.th"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="รหัสผ่าน (6+ ตัวอักษร)" required>
            {(id) => (
              <div className="relative">
                <Input
                  id={id}
                  type={showPassword ? "text" : "password"}
                  placeholder="รหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={14} />
                </button>
              </div>
            )}
          </Field>

          <Field label="ยืนยันรหัสผ่าน" required>
            {(id) => (
              <Input
                id={id}
                type={showPassword ? "text" : "password"}
                placeholder="ยืนยันรหัสผ่าน"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            )}
          </Field>
        </div>

        <Field label="บทบาทผู้ใช้งาน" required>
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="teacher">ครูผู้สอน (Teacher)</option>
              <option value="student">นักเรียน/นักศึกษา (Student)</option>
              <option value="admin">ผู้ดูแลระบบ (Admin)</option>
            </Select>
          )}
        </Field>

        {role === "teacher" && teachers.length > 0 && (
          <Field label="ผูกกับข้อมูลครูในระบบ (เลือกได้)">
            {(id) => (
              <Select id={id} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">-- ไม่ระบุ (สร้างข้อมูลครูใหม่ภายหลัง) --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teacherName(t)} ({t.code})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {role === "student" && dataset.groups.length > 0 && (
          <Field label="ผูกกับข้อมูลนักเรียน (เลือกได้)">
            {(id) => (
              <Select id={id} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">-- ไม่ระบุ (กำหนดภายหลัง) --</option>
                {dataset.groups.map((g) => (
                  <optgroup key={g.id} label={`กลุ่ม ${g.code} (${g.name})`}>
                    {dataset.students
                      .filter((s) => s.groupId === g.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} {s.displayName}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Button type="submit" variant="primary" loading={busy} className="mt-2 w-full py-2.5">
          ยืนยันการสมัครสมาชิก
        </Button>

        <p className="text-center text-xs text-muted">
          มีบัญชีอยู่แล้ว?{" "}
          <button type="button" onClick={onSwitchLogin} className="text-accent underline font-medium">
            เข้าสู่ระบบที่นี่
          </button>
        </p>
      </form>
    </Card>
  );
}

/* ---------------- Form เข้าใช้โหมดทดลอง (Demo) ---------------- */
function DemoLogin({
  dataset,
  onPick,
}: {
  dataset: Dataset;
  onPick: (s: Session) => void;
}) {
  const [teacherId, setTeacherId] = useState(dataset.teachers.find((t: Teacher) => t.id === "t05")?.id ?? dataset.teachers[0]?.id ?? "");
  const [studentId, setStudentId] = useState(dataset.students[0]?.id ?? "");
  const teachers = useMemo(() => [...dataset.teachers].sort((a: Teacher, b: Teacher) => a.code.localeCompare(b.code)), [dataset.teachers]);

  return (
    <div className="flex flex-col gap-3.5">
      <Card title="1. ผู้ดูแลระบบ (Admin)">
        <p className="mb-3 text-xs text-muted">
          เข้าถึงทุกฟังก์ชัน จัดการข้อมูลรายวิชา ครู ห้อง นำเข้าไฟล์ Excel จัดตารางด้วย AI และเผยแพร่
        </p>
        <Button
          variant="primary"
          className="w-full"
          onClick={() => onPick({ uid: "demo-admin", role: "admin", displayName: "ผู้ดูแลระบบ (สาธิต)" })}
        >
          เข้าสู่ระบบในฐานะ Admin
        </Button>
      </Card>

      <Card title="2. ครูผู้สอน (Teacher)">
        <p className="mb-2 text-xs text-muted">ดูตารางสอนของตนเอง ภาระงานสอน คาบว่าง และส่งออก PDF</p>
        <div className="flex flex-col gap-2.5">
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            {teachers.map((t: Teacher) => (
              <option key={t.id} value={t.id}>
                {teacherName(t)} ({t.code}) - {t.department || "วิชาการ"}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={!teacherId}
            onClick={() => {
              const t = dataset.teachers.find((x: Teacher) => x.id === teacherId);
              if (t) onPick({ uid: `demo-${t.id}`, role: "teacher", displayName: teacherName(t), teacherId: t.id });
            }}
          >
            เข้าสู่ระบบในฐานะ ครู
          </Button>
        </div>
      </Card>

      <Card title="3. นักเรียน / นักศึกษา (Student)">
        <p className="mb-2 text-xs text-muted">ดูตารางเรียนของกลุ่มตนเอง คาบกิจกรรม และพิมพ์ตารางเรียน</p>
        <div className="flex flex-col gap-2.5">
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {dataset.groups.map((g: StudentGroup) => (
              <optgroup key={g.id} label={`กลุ่ม ${g.code} (${g.name})`}>
                {dataset.students
                  .filter((s: Student) => s.groupId === g.id)
                  .map((s: Student) => (
                    <option key={s.id} value={s.id}>
                      {s.code} {s.displayName}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={!studentId}
            onClick={() => {
              const s = dataset.students.find((x: Student) => x.id === studentId);
              if (s) onPick({ uid: `demo-${s.id}`, role: "student", displayName: s.displayName, studentId: s.id, groupIds: [s.groupId] });
            }}
          >
            เข้าสู่ระบบในฐานะ นักเรียน
          </Button>
        </div>
      </Card>
    </div>
  );
}
