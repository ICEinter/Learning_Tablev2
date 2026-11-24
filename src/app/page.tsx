"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NAV } from "@/components/app-shell";
import { Icon, type IconName } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { useSession } from "@/lib/auth/session-context";
import { useData } from "@/lib/store/data-context";

export default function HomePage() {
  const { session, ready } = useSession();
  const { dataset } = useData();
  const router = useRouter();

  const userDashboardUrl = session ? NAV[session.role]?.[0]?.href || "/admin" : "/login";

  return (
    <div className="min-h-screen bg-page flex flex-col selection:bg-accent selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow-sm">
              LT
            </span>
            <div>
              <span className="block text-base font-bold text-ink tracking-tight">Learning Table</span>
              <span className="block text-[10px] text-muted -mt-0.5">ระบบจัดตารางการเรียนการสอน</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted">
            <a href="#features" className="hover:text-accent transition-colors">คุณสมบัติเด่น</a>
            <a href="#workflow" className="hover:text-accent transition-colors">ขั้นตอนการทำงาน</a>
            <Link href="/guide" className="hover:text-accent transition-colors">คู่มือการใช้งาน</Link>
          </nav>

          <div className="flex items-center gap-3">
            {ready && session ? (
              <Button variant="primary" onClick={() => router.push(userDashboardUrl)}>
                เข้าสู่แดชบอร์ด ({session.displayName})
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex text-sm font-semibold text-muted hover:text-ink px-3 py-1.5 transition-colors"
                >
                  เข้าสู่ระบบ
                </Link>
                <Button variant="primary" onClick={() => router.push("/login")}>
                  เริ่มต้นใช้งาน / สมัคร
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 lg:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage: "radial-gradient(#1561ad 1px, transparent 1px), radial-gradient(#d9d9d9 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            backgroundPosition: "0 0, 20px 20px",
          }}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink shadow-2xs mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Next.js App Router & Cloud Firestore Ready
          </div>

          <h1 className="mx-auto max-w-4xl text-3xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl leading-tight">
            จัดตารางการเรียนการสอนอัจฉริยะ
            <br />
            <span className="text-accent">รวดเร็ว ถูกต้อง แม่นยำ ไร้ข้อขัดแย้ง</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted leading-relaxed">
            ระบบจัดตารางสอนมาตรฐานสถานศึกษา จัดสรรคาบเรียนของครู ห้องเรียน และกลุ่มเรียนอย่างลงตัว
            ด้วย AI Heuristic + Genetic Algorithm พร้อมส่งออกเอกสาร PDF / Excel ครบถ้วนตามระเบียบ
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button
              variant="primary"
              className="text-base px-6 py-3 shadow-md hover:shadow-lg transition-all"
              onClick={() => router.push("/login")}
            >
              เข้าสู่ระบบ / สมัครสมาชิก
            </Button>
            <Link
              href="/login?mode=demo"
              className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink hover:bg-page transition-colors"
            >
              ทดลองใช้งานโหมดสาธิต (Demo)
            </Link>
          </div>

          {/* Key Stats Bar */}
          <div className="mx-auto mt-16 max-w-4xl grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-2xs">
              <span className="block text-2xl sm:text-3xl font-bold text-accent">100%</span>
              <span className="mt-1 block text-xs font-medium text-muted">Hard Constraints ผ่าน</span>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-2xs">
              <span className="block text-2xl sm:text-3xl font-bold text-ink">&lt; 3 วินาที</span>
              <span className="mt-1 block text-xs font-medium text-muted">ประมวลผลจัดตาราง</span>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-2xs">
              <span className="block text-2xl sm:text-3xl font-bold text-ink">5 มุมมอง</span>
              <span className="mt-1 block text-xs font-medium text-muted">ครู ห้อง กลุ่ม รายวิชา รวม</span>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-2xs">
              <span className="block text-2xl sm:text-3xl font-bold text-ok">0 ข้อผิดพลาด</span>
              <span className="mt-1 block text-xs font-medium text-muted">ตรวจชนก่อนเผยแพร่</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-20 border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-accent">คุณสมบัติระบบ</h2>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-ink">
              ออกแบบมาเพื่อตอบโจทย์สถานศึกษาทุกระดับ
            </p>
            <p className="mt-3 text-sm text-muted">
              ลดภาระงานฝ่ายวิชาการ จัดตารางได้ครอบคลุมทั้งสายสามัญ อาชีวศึกษา และอุดมศึกษา
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURE_CARDS.map((item) => (
              <div
                key={item.title}
                className="group relative rounded-2xl border border-line bg-page p-6 transition-all hover:border-accent hover:shadow-sm"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent mb-4 group-hover:bg-accent group-hover:text-white transition-colors">
                  <Icon name={item.icon} size={22} />
                </div>
                <h3 className="text-base font-bold text-ink">{item.title}</h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Stepper */}
      <section id="workflow" className="py-16 sm:py-20 bg-page border-t border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-accent">ขั้นตอนการทำงาน</h2>
            <p className="mt-2 text-2xl sm:text-3xl font-bold text-ink">
              4 ขั้นตอนง่ายๆ เพื่อตารางสอนที่สมบูรณ์แบบ
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, idx) => (
              <div key={step.title} className="relative rounded-2xl border border-line bg-surface p-6 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">
                    ขั้นตอนที่ {idx + 1}
                  </span>
                </div>
                <h3 className="text-base font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="py-16 bg-accent text-white relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-2xl sm:text-4xl font-bold">พร้อมเริ่มต้นจัดตารางสอนแล้วหรือยัง?</h2>
          <p className="mt-4 text-sm sm:text-base text-white/85 max-w-xl mx-auto">
            เข้าสู่ระบบ หรือเลือกโหมดสาธิตเพื่อทดสอบการทำงานของระบบได้ทันทีโดยไม่ต้องตั้งค่าใดๆ
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-accent shadow-md hover:bg-white/90 transition-all"
            >
              เข้าสู่ระบบ / สมัครสมาชิกทันที
            </Link>
            <Link
              href="/guide"
              className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              อ่านคู่มือและวิธีใช้งาน
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-surface py-8 text-xs text-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">Learning Table</span>
            <span>— ระบบจัดตารางการเรียนการสอน (Next.js + Firebase)</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/ICEinter/Learning_Table.git"
              target="_blank"
              rel="noreferrer"
              className="hover:text-accent transition-colors"
            >
              GitHub Repository
            </a>
            <Link href="/guide" className="hover:text-accent transition-colors">
              คู่มือระบบ
            </Link>
            <Link href="/login" className="hover:text-accent transition-colors">
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FEATURE_CARDS: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "spark",
    title: "AI & Genetic Algorithm",
    desc: "ประมวลผลจัดสรรคาบเรียนอัตโนมัติด้วยอัลกอริทึมทางพันธุศาสตร์ ควบคุมการกระจายคาบเรียนและลดคาบว่างของครู",
  },
  {
    icon: "shield",
    title: "ตรวจสอบข้อขัดแย้ง 100%",
    desc: "ระบบ Independent Validator รับประกันว่าครูไม่สอนชน ห้องไม่ทับซ้อน กลุ่มเรียนไม่ซ้ำ และนักเรียนไม่เรียนพร้อมกัน 2 คาบ",
  },
  {
    icon: "calendar",
    title: "5 มุมมองแบบฟอร์มมาตรฐาน",
    desc: "สลับดูตารางสอนของครู, ห้องปฏิบัติการ/ห้องเรียน, กลุ่มเรียนนักเรียน, รายวิชา และตารางรวมสถานศึกษาได้ทันที",
  },
  {
    icon: "upload",
    title: "นำเข้าข้อมูลจาก Excel / CSV",
    desc: "มีระบบพรีวิวและตรวจสอบความถูกต้องของข้อมูลก่อนนำเข้า แจ้งเตือนรหัสซ้ำ ข้อมูลไม่ตรง หรือรหัสอ้างอิงไม่พบ",
  },
  {
    icon: "file",
    title: "ส่งออก PDF & Excel ทางการ",
    desc: "รองรับภาษาไทยเต็มรูปแบบ สระไม่ลอย ตัดคำถูกต้องด้วยพจนานุกรมไทย พิมพ์แบบฟอร์ม A4 แนวนอนได้ทันที",
  },
  {
    icon: "users",
    title: "ระบบสิทธิ์ผู้ใช้งานครบวงจร",
    desc: "แยกสิทธิ์ชัดเจนระหว่างผู้ดูแลระบบ (Admin), ครูผู้สอน (Teacher) และนักเรียน (Student) พร้อมระบบความปลอดภัย",
  },
];

const STEPS = [
  {
    title: "1. โครงสร้างเวลา",
    desc: "กำหนดจำนวนคาบต่อวัน เวลาเริ่ม-สิ้นสุด คาบพักเที่ยง และคาบกิจกรรมล็อก เช่น กิจกรรมหน้าเสาธง หรือชุมนุม",
  },
  {
    title: "2. เตรียมข้อมูลหลัก",
    desc: "ป้อนข้อมูลหรือนำเข้าไฟล์ Excel ของครูผู้สอน ห้องเรียน รายวิชา กลุ่มเรียน และภาระงานสอนที่ได้รับมอบหมาย",
  },
  {
    title: "3. ประมวลผลจัดตาราง",
    desc: "คลิกจัดตารางด้วย AI ระบบจะค้นหาคำตอบที่เหมาะสมที่สุด พร้อมวิเคราะห์รายงานคาบว่างและภาระสอน",
  },
  {
    title: "4. เผยแพร่และใช้งาน",
    desc: "ปรับแต่งคาบเรียนด้วย Drag & Drop ตามต้องการ ตรวจสอบความถูกต้อง แล้วกดเผยแพร่ให้ครูและนักเรียนดูได้ทันที",
  },
];
