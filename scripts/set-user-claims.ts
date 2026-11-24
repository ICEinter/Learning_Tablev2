/**
 * อัปเดต schoolId และ role ของบัญชี Firebase Auth ที่มีอยู่แล้ว
 * ใช้เฉพาะผู้ดูแลที่เชื่อถือได้ และอ่าน service account จาก env เท่านั้น
 *
 * วิธีใช้:
 *   npx tsx --env-file=.env.local scripts/set-user-claims.ts <uid> <admin|teacher|student> [schoolId]
 */
import { getAdmin } from "../src/lib/firebase/admin";

const ALLOWED_ROLES = ["admin", "teacher", "student"] as const;

async function main() {
  const [uid, roleInput, schoolIdArg] = process.argv.slice(2);
  if (!uid || !roleInput || !ALLOWED_ROLES.includes(roleInput as (typeof ALLOWED_ROLES)[number])) {
    console.error("วิธีใช้: npx tsx --env-file=.env.local scripts/set-user-claims.ts <uid> <admin|teacher|student> [schoolId]");
    process.exit(1);
  }

  const schoolId = schoolIdArg?.trim() || process.env.NEXT_PUBLIC_SCHOOL_ID?.trim();
  if (!schoolId) {
    console.error("ต้องระบุ schoolId หรือกำหนด NEXT_PUBLIC_SCHOOL_ID ก่อน");
    process.exit(1);
  }

  const admin = await getAdmin();
  if (!admin) {
    console.error("ยังไม่ได้ตั้งค่า Firebase Admin service account");
    process.exit(1);
  }

  const user = await admin.auth.getUser(uid);
  const existing = user.customClaims ?? {};
  const role = roleInput as (typeof ALLOWED_ROLES)[number];
  const claims: Record<string, unknown> = { schoolId, role };

  if (role === "teacher" && typeof existing.teacherId === "string") claims.teacherId = existing.teacherId;
  if (role === "student") {
    if (typeof existing.studentId === "string") claims.studentId = existing.studentId;
    if (Array.isArray(existing.groupIds)) claims.groupIds = existing.groupIds.filter((value): value is string => typeof value === "string");
  }

  await admin.auth.setCustomUserClaims(uid, claims);
  console.log(`อัปเดตสิทธิ์สำเร็จ: uid=${uid} role=${role} schoolId=${schoolId}`);
  console.log("ผู้ใช้ต้องออกจากระบบแล้วเข้าสู่ระบบใหม่ หรือบังคับรีเฟรช ID token ก่อนอ่านข้อมูล");
}

main().catch((error) => {
  console.error("อัปเดตสิทธิ์ไม่สำเร็จ:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
