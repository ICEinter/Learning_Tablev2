"use client";
import { useMemo, useState } from "react";
import { Alert, Card, DataTable, Input } from "@/components/ui";
import { Pagination, pageSlice } from "@/components/data/pagination";
import { useData } from "@/lib/store/data-context";
import { teacherName } from "@/shared/slots";

export function DemoUsers() {
  const { dataset } = useData();
  const groupCode = useMemo(() => new Map(dataset.groups.map((g) => [g.id, g.code])), [dataset.groups]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const students = useMemo(() => {
    const s = q.trim().toLowerCase();
    return dataset.students.filter((x) => !s || `${x.code} ${x.displayName}`.toLowerCase().includes(s));
  }, [dataset.students, q]);
  const { rows, page: current, pageCount } = pageSlice(students, page);

  return (
    <div className="flex flex-col gap-5">
      <Alert tone="warn" title="โหมดสาธิต — ไม่มีการยืนยันตัวตนจริง">
        ยังไม่ได้ตั้งค่า Firebase จึงใช้การ &quot;เลือกบทบาท/บุคคล&quot; ที่หน้าเข้าสู่ระบบแทนการล็อกอิน ทุกคนที่เปิดเว็บเลือกเป็นใครก็ได้ ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น — ห้ามใช้กับข้อมูลจริง
        เมื่อตั้งค่า Firebase แล้ว หน้านี้จะใช้สร้างบัญชีผู้ใช้ (อีเมล/รหัสผ่าน) และผูกกับข้อมูลครู/นักเรียน
      </Alert>

      <Card title={`ครู (${dataset.teachers.length}) — เลือกเข้าสู่ระบบเป็นครูได้ด้วยรายชื่อนี้`}>
        <DataTable className="max-h-96 overflow-y-auto">
          <thead className="sticky top-0">
            <tr>
              <th scope="col">รหัส</th>
              <th scope="col">ชื่อ-สกุล</th>
              <th scope="col">teacherId</th>
              <th scope="col">อีเมล</th>
            </tr>
          </thead>
          <tbody>
            {dataset.teachers.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.code}</td>
                <td className="whitespace-nowrap">{teacherName(t)}</td>
                <td>
                  <code className="text-xs">{t.id}</code>
                </td>
                <td>{t.email ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>

      <Card title={`นักเรียน (${dataset.students.length})`}>
        <div className="flex flex-col gap-3">
          <Input
            type="search"
            aria-label="ค้นหานักเรียน"
            placeholder="ค้นหารหัสหรือชื่อ"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="sm:max-w-xs"
          />
          <DataTable>
            <thead>
              <tr>
                <th scope="col">รหัส</th>
                <th scope="col">ชื่อที่แสดง</th>
                <th scope="col">กลุ่ม</th>
                <th scope="col">studentId</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.code}</td>
                  <td>{s.displayName}</td>
                  <td>{groupCode.get(s.groupId) ?? "-"}</td>
                  <td>
                    <code className="text-xs">{s.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={current} pageCount={pageCount} total={students.length} onChange={setPage} />
        </div>
      </Card>
    </div>
  );
}
