"use client";
import { PageHeader, Spinner } from "@/components/ui";
import { useSession } from "@/lib/auth/session-context";
import { DemoUsers } from "./_components/demo-users";
import { FirebaseUsers } from "./_components/firebase-users";

export default function UsersPage() {
  const { mode, ready } = useSession();
  return (
    <>
      <PageHeader title="ผู้ใช้และสิทธิ์" description="สร้างบัญชีและผูกกับข้อมูลครู/นักเรียน เพื่อให้เห็นเฉพาะตารางของตนเอง" />
      {!ready ? (
        <div className="flex items-center gap-2 py-10 text-muted">
          <Spinner /> กำลังโหลด…
        </div>
      ) : mode === "demo" ? (
        <DemoUsers />
      ) : (
        <FirebaseUsers />
      )}
    </>
  );
}
