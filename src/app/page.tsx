"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NAV } from "@/components/app-shell";
import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui";
import { useSession } from "@/lib/auth/session-context";

export default function HomePage() {
  const { session, ready, signInDemo } = useSession();
  const router = useRouter();

  
  const handleEnterAdmin = () => {
    if (!session) {
      signInDemo({
        uid: "demo-admin",
        displayName: "ผู้ดูแลระบบ (สาธิต)",
        role: "admin",
      });
    }
    router.push("/admin");
  };

  const handleEnterRole = (role: "admin" | "teacher" | "student") => {
    const rolesMap = {
      admin: { uid: "demo-admin", displayName: "ผู้ดูแลระบบ", role: "admin" as const },
      teacher: { uid: "demo-teacher", displayName: "อ.ปริญญา จำเนียรพล", role: "teacher" as const, teacherId: "t-901002" },
      student: { uid: "demo-student", displayName: "นักเรียน สIT.1/1", role: "student" as const, groupIds: ["g-693190101"] },
    };
    signInDemo(rolesMap[role]);
    router.push(role === "admin" ? "/admin" : `/${role}`);
  };

  return (
    <div className="min-h-screen bg-page flex flex-col text-ink selection:bg-accent selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow-sm ring-2 ring-accent/20">
              LT
            </span>
            <div>
              <span className="block text-base font-bold text-ink tracking-tight">Learning Table</span>
              <span className="block text-[11px] text-muted -mt-0.5">ระบบจัดตารางการเรียนการสอน</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted">
            <a href="#features" className="hover:text-accent transition-colors">คุณสมบัติเด่น</a>
            <a href="#workflow" className="hover:text-accent transition-colors">ขั้นตอนการทำงาน</a>
            <a href="#roles" className="hover:text-accent transition-colors">เข้าใช้งานตามบทบาท</a>
            <Link href="/guide" className="hover:text-accent transition-colors">คู่มือการใช้งาน</Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="primary"
              className="text-xs sm:text-sm px-3.5 py-2 shadow-sm font-medium"
              onClick={handleEnterAdmin}
            >
              {ready && session ? `เข้าสู่ระบบ (${session.displayName})` : "เข้าสู่แดชบอร์ดผู้ดูแลระบบ"}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 sm:py-20 lg:py-24 border-b border-line bg-gradient-to-b from-surface/50 to-page">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink shadow-2xs mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Next.js App Router & Cloud Firestore Ready
          </div>

          <h1 className="mx-auto max-w-4xl text-2xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl leading-tight">
            จัดตารางการเรียนการสอนอัจฉริยะ
            <br />
            <span className="text-accent">รวดเร็ว ถูกต้อง แม่นยำ ไร้ข้อขัดแย้ง</span>
          </h1>

          <p className="mx-auto mt-4 sm:mt-6 max-w-2xl text-sm sm:text-lg text-muted leading-relaxed px-2">
            ระบบจัดตารางสอนมาตรฐานสถานศึกษา จัดสรรคาบเรียนของครู ห้องเรียน และกลุ่มเรียนอย่างลงตัว
            ด้วย AI Heuristic + Genetic Algorithm พร้อมส่งออกเอกสาร PDF / Excel ครบถ้วนตามระเบียบ
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="primary"
              size="md"
              className="w-full sm:w-auto text-sm sm:text-base px-6 py-3 shadow-md hover:shadow-lg transition-all font-semibold"
              onClick={handleEnterAdmin}
            >
              เข้าสู่ระบบ / เริ่มต้นใช้งาน
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full sm:w-auto text-sm sm:text-base px-6 py-3 font-semibold"
              onClick={() => handleEnterRole("admin")}
            >
              ทดลองใช้งานโหมดสาธิต (Demo)
            </Button>
          </div>

          {/* Quick Metrics Badge Grid */}
          <div className="mt-12 sm:mt-16 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 max-w-4xl mx-auto">
            <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-2xs">
              <div className="text-xl sm:text-3xl font-bold text-accent">100%</div>
              <div className="mt-1 text-xs sm:text-sm text-muted">Hard Constraints ผ่าน</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-2xs">
              <div className="text-xl sm:text-3xl font-bold text-ink">&lt; 3 วินาที</div>
              <div className="mt-1 text-xs sm:text-sm text-muted">ประมวลผลจัดตาราง</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-2xs">
              <div className="text-xl sm:text-3xl font-bold text-ink">5 มุมมอง</div>
              <div className="mt-1 text-xs sm:text-sm text-muted">ครู ห้อง กลุ่ม รายวิชา รวม</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 text-center shadow-2xs">
              <div className="text-xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">0 ข้อผิดพลาด</div>
              <div className="mt-1 text-xs sm:text-sm text-muted">ตรวจชนก่อนเผยแพร่</div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Picker Section */}
      <section id="roles" className="py-12 sm:py-16 bg-surface border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-3xl font-bold text-ink">เข้าใช้งานตามบทบาทในสถานศึกษา</h2>
            <p className="mt-2 text-xs sm:text-sm text-muted">เลือกมุมมองที่ต้องการทดสอบใช้งานได้ในคลิกเดียว</p>
          </div>

          <div className="grid gap-4 sm:gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-page p-5 sm:p-6 flex flex-col justify-between hover:border-accent transition-all">
              <div>
                <span className="inline-flex p-3 rounded-lg bg-accent/10 text-accent mb-4">
                  <Icon name="dashboard" className="h-6 w-6" />
                </span>
                <h3 className="text-base sm:text-lg font-bold text-ink">ผู้ดูแลระบบ (Admin)</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  จัดการข้อมูลวิชา ครู ห้องเรียน นำเข้า CSV รัน AI จัดตาราง และตรวจสอบข้อขัดแย้ง
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="mt-6 w-full"
                onClick={() => handleEnterRole("admin")}
              >
                เข้าใช้งานมุมมองผู้ดูแล
              </Button>
            </div>

            <div className="rounded-xl border border-line bg-page p-5 sm:p-6 flex flex-col justify-between hover:border-accent transition-all">
              <div>
                <span className="inline-flex p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-4">
                  <Icon name="calendar" className="h-6 w-6" />
                </span>
                <h3 className="text-base sm:text-lg font-bold text-ink">ครูผู้สอน (Teacher)</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  ดูตารางสอนทางการ 13 คาบ สรุปภาระงาน ท.ป.น.ช. และดาวน์โหลดเอกสาร PDF / Excel
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-6 w-full"
                onClick={() => handleEnterRole("teacher")}
              >
                เข้าใช้งานมุมมองครู
              </Button>
            </div>

            <div className="rounded-xl border border-line bg-page p-5 sm:p-6 flex flex-col justify-between hover:border-accent transition-all">
              <div>
                <span className="inline-flex p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4">
                  <Icon name="users" className="h-6 w-6" />
                </span>
                <h3 className="text-base sm:text-lg font-bold text-ink">นักเรียน / นักศึกษา (Student)</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  ดูตารางเรียนประจำกลุ่ม คาบเรียน ห้องเรียน และกิจกรรมหน้าเสาธง
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-6 w-full"
                onClick={() => handleEnterRole("student")}
              >
                เข้าใช้งานมุมมองนักเรียน
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-20 bg-page">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-accent">ความสามารถของระบบ</h2>
            <p className="mt-2 text-2xl sm:text-4xl font-extrabold text-ink">
              ออกแบบตามมาตรฐานสถานศึกษา สอศ.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "spark" as IconName,
                title: "3 อัลกอริทึม + AI Scheduling Agent",
                desc: "เลือกได้ทั้ง Greedy Heuristic, Genetic Algorithm (GA), Conflict-Driven Tabu Search หรือโหมด Agent อัตโนมัติ",
              },
              {
                icon: "database" as IconName,
                title: "1-Click ข้อมูลจริง วท.ระยอง",
                desc: "นำเข้าโครงสร้างจริงวิทยาลัยเทคนิคระยอง ภาค 2/2569 ได้ในคลิกเดียว ตรวจสอบและพรีวิวก่อนบันทึก",
              },
              {
                icon: "report" as IconName,
                title: "แบบฟอร์มทางการ พร้อมเซ็นชื่อ 4 ฝ่าย",
                desc: "หัวตาราง 4 บรรทัด คาบ 1–13 ช่วงเวลา 08:30–21:30 พร้อมช่องลงนาม 4 ตำแหน่งตรงตามระเบียบ",
              },
              {
                icon: "upload" as IconName,
                title: "Export PDF และ Excel ในเซลล์จริง",
                desc: "ดาวน์โหลด PDF ภาษาไทยคมชัดแนวนอน A4 พร้อมไฟล์ Excel ที่แก้ไขสูตรต่อได้จริง",
              },
              {
                icon: "shield" as IconName,
                title: "Independent Validator ป้องกันตารางชน",
                desc: "ตรวจสอบข้อขัดแย้ง Hard Constraints ละเอียดยิบ ทั้งหลังประมวลผลและหลังการปรับด้วยมือ",
              },
              {
                icon: "refresh" as IconName,
                title: "Cloud Firestore & Zero-Risk Fallback",
                desc: "เชื่อมต่อคลาวด์มาตรฐาน พร้อมระบบสำรองในเครื่อง (Offline Mode) รันได้ลื่นไหลไม่ต้องกลัวเน็ตหลุด",
              },
            ].map((f, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-6 shadow-2xs hover:border-accent/40 transition-colors">
                <span className="inline-flex p-2.5 rounded-lg bg-accent/10 text-accent mb-4">
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                <h3 className="text-base font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-line bg-surface py-8 text-center text-xs text-muted">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-accent text-white flex items-center justify-center font-bold text-xs">
              LT
            </span>
            <span className="font-semibold text-ink">Learning Table V2</span>
            <span>— แผนกวิชาเทคโนโลยีสารสนเทศและการสื่อสาร วิทยาลัยเทคนิคระยอง</span>
          </div>
          <div className="flex gap-4">
            <Link href="/guide" className="hover:text-accent">คู่มือการใช้งาน</Link>
            <a href="#features" className="hover:text-accent">คุณสมบัติ</a>
            <button onClick={handleEnterAdmin} className="hover:text-accent">เข้าสู่ระบบ</button>
          </div>
        </div>
      </footer>
    </div>
  );
}