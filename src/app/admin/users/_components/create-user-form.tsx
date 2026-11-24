"use client";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Alert, Button, Card, Field, Input, Select, useToast } from "@/components/ui";
import { errorMessage, hasErrors, zodFieldErrors, type FieldErrors } from "@/components/data/form-utils";
import { useData } from "@/lib/store/data-context";
import { teacherName } from "@/shared/slots";
import type { Role } from "@/shared/types";
import { createUser } from "./api";

const ROLE_LABEL: Record<Role, string> = { admin: "ผู้ดูแลระบบ", teacher: "ครู", student: "นักเรียน" };

const FormSchema = z
  .object({
    email: z.email("อีเมลไม่ถูกต้อง"),
    password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกินไป"),
    displayName: z.string().trim().min(1, "ต้องระบุชื่อที่แสดง").max(120),
    role: z.enum(["admin", "teacher", "student"]),
    teacherId: z.string().optional(),
    studentId: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "teacher" && !v.teacherId) ctx.addIssue({ code: "custom", path: ["teacherId"], message: "บัญชีครูต้องผูกกับข้อมูลครู" });
    if (v.role === "student" && !v.studentId) ctx.addIssue({ code: "custom", path: ["studentId"], message: "บัญชีนักเรียนต้องผูกกับข้อมูลนักเรียน" });
  });

export function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const { dataset } = useData();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("teacher");
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickTeacher = (id: string) => {
    setTeacherId(id);
    const t = dataset.teachers.find((x) => x.id === id);
    if (t && !displayName) setDisplayName(teacherName(t));
    if (t?.email && !email) setEmail(t.email);
  };
  const pickStudent = (id: string) => {
    setStudentId(id);
    const s = dataset.students.find((x) => x.id === id);
    if (s && !displayName) setDisplayName(s.displayName);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const input = {
      email: email.trim(),
      password,
      displayName: displayName.trim(),
      role,
      ...(role === "teacher" && teacherId ? { teacherId } : {}),
      ...(role === "student" && studentId ? { studentId } : {}),
    };
    const r = FormSchema.safeParse(input);
    const errs = r.success ? {} : zodFieldErrors(r.error);
    setErrors(errs);
    if (hasErrors(errs)) return;
    setBusy(true);
    try {
      await createUser(input);
      toast(`สร้างบัญชี ${input.email} แล้ว`, "ok");
      setEmail("");
      setPassword("");
      setDisplayName("");
      setTeacherId("");
      setStudentId("");
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="สร้างบัญชีผู้ใช้">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {serverError && (
          <Alert tone="danger" title="สร้างบัญชีไม่สำเร็จ">
            {serverError}
          </Alert>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="บทบาท" required error={errors.role}>
            {(id) => (
              <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {role === "teacher" && (
            <Field label="ผูกกับข้อมูลครู" required error={errors.teacherId}>
              {(id) => (
                <Select id={id} value={teacherId} onChange={(e) => pickTeacher(e.target.value)}>
                  <option value="">— เลือกครู —</option>
                  {dataset.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} · {teacherName(t)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {role === "student" && (
            <Field label="ผูกกับข้อมูลนักเรียน" required error={errors.studentId}>
              {(id) => (
                <Select id={id} value={studentId} onChange={(e) => pickStudent(e.target.value)}>
                  <option value="">— เลือกนักเรียน —</option>
                  {dataset.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.displayName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="ชื่อที่แสดง" required error={errors.displayName}>
            {(id) => <Input id={id} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="off" />}
          </Field>
          <Field label="อีเมล" required error={errors.email}>
            {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}
          </Field>
          <Field label="รหัสผ่านเริ่มต้น" required error={errors.password} hint="อย่างน้อย 8 ตัวอักษร แจ้งผู้ใช้ให้เปลี่ยนหลังเข้าสู่ระบบครั้งแรก">
            {(id) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={busy}>
            สร้างบัญชี
          </Button>
        </div>
      </form>
    </Card>
  );
}

export { ROLE_LABEL };
