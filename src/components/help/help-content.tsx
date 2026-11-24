"use client";
/**
 * คู่มือการใช้งานในระบบ — แสดงตามบทบาท (ผู้ดูแล / ครู / นักเรียน)
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Badge, Card, Tabs } from "@/components/ui";
import type { Role } from "@/shared/types";

interface Step {
  title: string;
  icon: IconName;
  href?: string;
  linkLabel?: string;
  body: ReactNode;
  tips?: string[];
}

const ADMIN_STEPS: Step[] = [
  {
    title: "ตั้งค่าสถานศึกษา ภาคเรียน และโครงสร้างเวลา",
    icon: "settings",
    href: "/admin/setup",
    linkLabel: "ไปหน้าตั้งค่า",
    body: (
      <>
        กำหนดชื่อสถานศึกษา ผู้ลงนามท้ายตาราง ปีการศึกษา/ภาคเรียน วันที่เปิดเรียน จำนวนคาบและเวลาเริ่ม–สิ้นสุดของแต่ละคาบ คาบพัก และกิจกรรมก่อนคาบแรก (เช่น
        กิจกรรมหน้าเสาธง)
      </>
    ),
    tips: ["“เวลาสิ้นสุดในเวลาราชการ” ใช้แยกชั่วโมง รวมใน / รวมนอก ในตารางสอนครู", "การเปลี่ยนจำนวนคาบหลังจัดตารางแล้ว อาจทำให้ตารางเดิมมีข้อขัดแย้ง"],
  },
  {
    title: "นำเข้าหรือกรอกข้อมูลหลัก",
    icon: "upload",
    href: "/admin/import",
    linkLabel: "ไปหน้านำเข้าข้อมูล",
    body: (
      <>
        ดาวน์โหลดแม่แบบ (Excel/CSV) กรอกข้อมูล แล้วอัปโหลด ระบบจะจับคู่คอลัมน์ แสดงพรีวิว และตรวจข้อมูลผิด/ซ้ำ/ขาด/อ้างอิงไม่พบ ก่อนให้ยืนยันบันทึก
        ลำดับที่แนะนำ: ห้องเรียน → รายวิชา → ครู → กลุ่มเรียน → การมอบหมายสอน → นักเรียน → กิจกรรมล็อกเวลา
      </>
    ),
    tips: ["อ้างอิงข้อมูลด้วย “รหัส” เช่น รหัสวิชา รหัสครู รหัสกลุ่ม", "รหัสที่มีอยู่แล้วจะถูกอัปเดต รหัสใหม่จะถูกเพิ่ม", "แก้ไขรายการเดี่ยวได้ที่เมนู “ข้อมูลหลัก”"],
  },
  {
    title: "ตรวจความครบถ้วนที่แดชบอร์ด",
    icon: "dashboard",
    href: "/admin",
    linkLabel: "ไปแดชบอร์ด",
    body: <>แดชบอร์ดสรุปจำนวนข้อมูล ข้อผิดพลาด/คำเตือน และผล Pre-check ซึ่งบอกพร้อมหลักฐานหากข้อมูลจัดตารางไม่ได้ (เช่น ภาระครูเกินเวลาที่ว่าง ไม่มีห้องที่ตรงเงื่อนไข)</>,
  },
  {
    title: "จัดตารางอัตโนมัติ",
    icon: "spark",
    href: "/admin/solve",
    linkLabel: "ไปหน้าจัดตาราง",
    body: (
      <>
        เลือกอัลกอริทึม: <b>Heuristic</b> (เร็ว ใช้เป็น baseline), <b>Genetic Algorithm</b> (ปรับคุณภาพ) หรือ <b>Agent</b> (วางแผน → คำนวณ → ตรวจผล → ปรับพารามิเตอร์แล้วลองซ้ำ)
        กำหนด seed เวลาสูงสุด และน้ำหนัก Soft Constraints ได้ ระหว่างคำนวณดูความคืบหน้าและกดยกเลิกได้ เมื่อเสร็จให้กด “บันทึกเป็นฉบับร่าง”
      </>
    ),
    tips: [
      "Hard Constraints (ห้ามชน/ห้องต้องตรงเงื่อนไข ฯลฯ) จะไม่ถูกผ่อนปรนเด็ดขาด",
      "ถ้าหาไม่พบภายในเวลา ระบบจะแจ้งตามจริงพร้อมผลดีที่สุดและรายการข้อขัดแย้ง",
      "แท็บ “เปรียบเทียบอัลกอริทึม” รัน baseline กับ GA ด้วย seed เดียวกันแล้วแสดงผลจริง",
    ],
  },
  {
    title: "ตรวจ แก้ไข และเผยแพร่ตาราง",
    icon: "calendar",
    href: "/admin/timetables",
    linkLabel: "ไปหน้าตาราง",
    body: (
      <>
        เปิดฉบับร่างเพื่อดูตารางตามครู ห้อง กลุ่มเรียน นักเรียน รายวิชา หรือตารางรวม กด “แก้ไขตาราง” แล้วเลือกคาบ ระบบจะไฮไลต์ช่องที่ย้ายไปได้และตรวจการชนใหม่ทุกครั้ง
        บันทึกได้เมื่อไม่มีข้อขัดแย้ง Hard จากนั้นกด “เผยแพร่” เพื่อให้ครูและนักเรียนเห็น
      </>
    ),
    tips: ["ฉบับร่างมองเห็นเฉพาะผู้ดูแล", "ฉบับที่เผยแพร่แก้ไขไม่ได้ ให้ทำสำเนาเป็นร่างก่อน"],
  },
  {
    title: "ออกรายงานและส่งออก PDF / Excel",
    icon: "report",
    href: "/admin/reports",
    linkLabel: "ไปหน้ารายงาน",
    body: <>รายงานภาระสอน คาบว่าง การใช้ห้อง และข้อขัดแย้ง ส่งออกเป็น PDF (A4 แนวนอน ภาษาไทย) หรือ Excel (แก้ไขในเซลล์ได้) มีพรีวิวและปุ่มพิมพ์ ตารางสอนรายครูส่งออกได้ทั้งรายคนและทั้งหมด</>,
  },
  {
    title: "จัดการผู้ใช้และสิทธิ์",
    icon: "users",
    href: "/admin/users",
    linkLabel: "ไปหน้าผู้ใช้",
    body: <>เมื่อเชื่อมต่อ Firebase แล้ว สร้างบัญชีให้ครู/นักเรียนและผูกกับข้อมูลในระบบ บทบาทกำหนดสิทธิ์การมองเห็นข้อมูล (ครูเห็นตารางของตนเอง นักเรียนเห็นตารางของตนเองและกลุ่ม)</>,
  },
];

const TEACHER_STEPS: Step[] = [
  { title: "ดูตารางสอนของฉัน", icon: "calendar", href: "/teacher", linkLabel: "เปิดตารางสอน", body: <>หลังเข้าสู่ระบบจะเห็นตารางสอนฉบับที่เผยแพร่ล่าสุด: วันเป็นแถว คาบพร้อมเวลาเป็นคอลัมน์ แต่ละช่องแสดงรหัสวิชา ห้อง และกลุ่มเรียน คาบต่อเนื่องจะรวมเป็นช่องเดียว</> },
  { title: "อ่านสรุปภาระสอน", icon: "clock", body: <>ตารางด้านบนสรุปรายวิชา (ท. ป. น. ช.) และกิจกรรม เช่น Home Room, PLC ซึ่งแสดงแยกจากคาบสอน พร้อมจำนวนคาบว่างคั่นและชั่วโมงในเวลา/นอกเวลา</> },
  { title: "ส่งออกหรือพิมพ์", icon: "file", body: <>กด “ดาวน์โหลด PDF”, “Excel” หรือ “พิมพ์” เพื่อนำตารางไปใช้งาน แตะที่ช่องคาบเพื่อดูรายละเอียดวิชา ห้อง และกลุ่มเรียน</> },
];

const STUDENT_STEPS: Step[] = [
  { title: "ดูตารางเรียนของฉัน", icon: "calendar", href: "/student", linkLabel: "เปิดตารางเรียน", body: <>ตารางแสดงรายวิชาของกลุ่มเรียน รวมวิชาที่ลงทะเบียนเพิ่มข้ามกลุ่ม (ถ้ามี) เฉพาะฉบับที่ผู้ดูแลเผยแพร่แล้ว</> },
  { title: "ดูตารางของกลุ่มเรียน", icon: "users", body: <>สลับไปดูตารางของกลุ่มที่ตนเองสังกัดได้ บนโทรศัพท์ตารางจะแสดงเป็นรายวัน เลื่อนเลือกวันได้</> },
  { title: "ส่งออกหรือพิมพ์", icon: "file", body: <>ดาวน์โหลดเป็น PDF/Excel หรือสั่งพิมพ์ได้จากปุ่มด้านบนตาราง</> },
];

const FAQ: { q: string; a: ReactNode }[] = [
  { q: "โหมดสาธิตคืออะไร", a: <>เมื่อยังไม่ได้ตั้งค่า Firebase ระบบจะใช้ข้อมูลจำลองและเก็บข้อมูลไว้ในเบราว์เซอร์เครื่องนั้น เหมาะสำหรับทดลองและสาธิต ข้อมูลไม่ถูกแชร์ระหว่างเครื่อง และการเข้าสู่ระบบเป็นการเลือกบทบาท ไม่ใช่การยืนยันตัวตนจริง</> },
  { q: "ต้องการเริ่มใหม่ด้วยข้อมูลจำลอง", a: <>ผู้ดูแลไปที่ “ตั้งค่าปี/ภาค/เวลา” แล้วกด “รีเซ็ตเป็นข้อมูลจำลอง”</> },
  { q: "ทำไมเผยแพร่ตารางไม่ได้", a: <>ตารางที่ยังมีข้อขัดแย้ง Hard (เช่น ครูสอนชน ห้องชน) จะเผยแพร่ไม่ได้ ให้เปิดตารางเพื่อดูรายการข้อขัดแย้งแล้วแก้ไข หรือจัดตารางใหม่</> },
  { q: "ระบบบอกว่า “ไม่พบตารางภายในเวลาที่กำหนด”", a: <>หมายถึงยังหาไม่พบ ไม่ได้แปลว่าเป็นไปไม่ได้ ลองเพิ่มเวลา เปลี่ยน seed ใช้โหมด Agent หรือดูคำอธิบายผลว่าคอขวดอยู่ที่ครู ห้อง หรือกลุ่มใด</> },
  { q: "ภาษาไทยใน PDF", a: <>PDF ฝังฟอนต์ Sarabun และจัดหน้า A4 แนวนอน หัวตารางจะแสดงซ้ำเมื่อขึ้นหน้าใหม่</> },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={s.title} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">{i + 1}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                <Icon name={s.icon} className="text-accent" />
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{s.body}</p>
              {s.tips && (
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {s.tips.map((t) => (
                    <li key={t} className="flex gap-2">
                      <Icon name="check" size={16} className="mt-0.5 shrink-0 text-ok" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.href && (
                <Link href={s.href} className="mt-3 inline-flex text-sm font-medium text-accent underline underline-offset-2">
                  {s.linkLabel} →
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** role = บทบาทที่แสดงเริ่มต้น; showAll = แสดงแท็บทุกบทบาท (หน้าคู่มือสาธารณะ) ; linkable = ลิงก์ไปหน้าต่าง ๆ ได้ (ต้อง login แล้ว) */
export function HelpContent({ role, showAll = false, linkable = true }: { role: Role; showAll?: boolean; linkable?: boolean }) {
  const [tab, setTab] = useState<Role>(role);
  const steps = (tab === "admin" ? ADMIN_STEPS : tab === "teacher" ? TEACHER_STEPS : STUDENT_STEPS).map((s) => (linkable && tab === role ? s : { ...s, href: undefined }));

  return (
    <div className="flex flex-col gap-5">
      {showAll && (
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "admin", label: "ผู้ดูแลระบบ" },
            { value: "teacher", label: "ครู" },
            { value: "student", label: "นักเรียน" },
          ]}
        />
      )}

      {tab === "admin" && (
        <Card title="ทดลองใช้ระบบตัวอย่างใน 5 นาที">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
            <li>เข้าสู่ระบบเป็น <b>ผู้ดูแลระบบ</b> — ระบบตัวอย่างมีข้อมูลจำลองครบ (รายวิชา ครู ห้อง กลุ่มเรียน นักเรียน การมอบหมายสอน) และมีตารางตัวอย่างที่เผยแพร่แล้ว</li>
            <li>เปิดเมนู <b>ตารางเรียน/สอน</b> เพื่อดูตารางตัวอย่างในมุมมองครู ห้อง กลุ่มเรียน และลองส่งออก PDF/Excel</li>
            <li>เปิดเมนู <b>จัดตารางอัตโนมัติ</b> เลือก Agent แล้วกด “เริ่มคำนวณ” จากนั้น “บันทึกเป็นฉบับร่าง”</li>
            <li>เปิดฉบับร่าง กด “แก้ไขตาราง” ลองย้ายคาบ แล้วบันทึกและเผยแพร่</li>
            <li>ออกจากระบบ แล้วเข้าเป็น <b>ครู</b> หรือ <b>นักเรียน</b> เพื่อดูตารางของตนเอง</li>
          </ol>
        </Card>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          ขั้นตอนการใช้งาน <Badge tone="accent">{tab === "admin" ? "ผู้ดูแลระบบ" : tab === "teacher" ? "ครู" : "นักเรียน"}</Badge>
        </h2>
        <StepList steps={steps} />
      </section>

      {tab === "admin" && (
        <Card title="ความหมายของเงื่อนไข">
          <div className="grid gap-4 text-sm leading-relaxed md:grid-cols-2">
            <div>
              <h3 className="mb-1 font-semibold text-danger">Hard Constraints — ต้องเป็นจริงเสมอ</h3>
              <ul className="list-disc space-y-0.5 pl-5">
                <li>ครู ห้อง กลุ่มเรียน และนักเรียนที่ลงทะเบียนร่วมกัน ห้ามมีคาบชน</li>
                <li>จำนวนคาบและคาบต่อเนื่องครบตามรายวิชา</li>
                <li>ครูต้องมีคุณสมบัติสอนวิชานั้น</li>
                <li>ความจุ ประเภท และอุปกรณ์ห้องต้องตรงเงื่อนไข</li>
                <li>ห้ามทับเวลาไม่พร้อม เวลาพัก และกิจกรรมที่ล็อกไว้</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-1 font-semibold text-accent">Soft Constraints — ยิ่งน้อยยิ่งดี (ปรับน้ำหนักได้)</h3>
              <ul className="list-disc space-y-0.5 pl-5">
                <li>คาบว่างคั่นของครูและผู้เรียน</li>
                <li>ความสมดุลของภาระรายวัน</li>
                <li>การย้ายห้องระหว่างคาบติดกัน</li>
                <li>เวลาที่ครูขอเลี่ยง และคาบนอกเวลาราชการ</li>
                <li>วิชาเดียวกันซ้ำในวันเดียว</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card title="คำถามที่พบบ่อย">
        <dl className="divide-y divide-line">
          {FAQ.map((f) => (
            <div key={f.q} className="py-3 first:pt-0 last:pb-0">
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
