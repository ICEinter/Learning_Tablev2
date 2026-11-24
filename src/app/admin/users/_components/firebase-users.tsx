"use client";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, DataTable, EmptyState, Spinner } from "@/components/ui";
import { errorMessage } from "@/components/data/form-utils";
import { useData } from "@/lib/store/data-context";
import { teacherName } from "@/shared/slots";
import { listUsers, type AdminUser } from "./api";
import { CreateUserForm, ROLE_LABEL } from "./create-user-form";

export function FirebaseUsers() {
  const { dataset } = useData();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const linked = useMemo(() => {
    const t = new Map(dataset.teachers.map((x) => [x.id, teacherName(x)]));
    const s = new Map(dataset.students.map((x) => [x.id, `${x.code} ${x.displayName}`]));
    return (u: AdminUser) => (u.teacherId ? (t.get(u.teacherId) ?? `ไม่พบครู ${u.teacherId}`) : u.studentId ? (s.get(u.studentId) ?? `ไม่พบนักเรียน ${u.studentId}`) : "-");
  }, [dataset.teachers, dataset.students]);

  const [reloadKey, setReloadKey] = useState(0);

  // โหลดรายการผู้ใช้ (setState เฉพาะใน callback ของ promise)
  useEffect(() => {
    let alive = true;
    listUsers()
      .then((list) => {
        if (!alive) return;
        setUsers(list);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const refresh = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-5">
      <CreateUserForm onCreated={refresh} />
      <Card
        title={`บัญชีผู้ใช้ (${users.length})`}
        actions={
          <Button size="sm" onClick={refresh} loading={loading}>
            รีเฟรช
          </Button>
        }
      >
        {error ? (
          <Alert tone="danger" title="โหลดรายชื่อผู้ใช้ไม่สำเร็จ">
            {error}
          </Alert>
        ) : loading && users.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-muted">
            <Spinner /> กำลังโหลด…
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="ยังไม่มีบัญชีผู้ใช้" />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th scope="col">ชื่อที่แสดง</th>
                <th scope="col">อีเมล</th>
                <th scope="col">บทบาท</th>
                <th scope="col">ผูกกับข้อมูล</th>
                <th scope="col">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td>{u.displayName || "-"}</td>
                  <td className="break-all">{u.email}</td>
                  <td>
                    <Badge tone={u.role === "admin" ? "accent" : "neutral"}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                  </td>
                  <td>{linked(u)}</td>
                  <td>{u.disabled ? <Badge tone="danger">ปิดใช้งาน</Badge> : <Badge tone="ok">ใช้งาน</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
