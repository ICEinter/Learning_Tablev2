/**
 * สร้างผู้ดูแลระบบคนแรก (ใช้ครั้งเดียวหลังตั้งค่า Firebase project)
 *
 * วิธีใช้ (อ่าน env จาก .env.local — ต้องมี FIREBASE_ADMIN_* และ NEXT_PUBLIC_SCHOOL_ID):
 *   npx tsx --env-file=.env.local scripts/create-admin.ts admin@example.com "รหัสผ่านอย่างน้อย8ตัว" "ชื่อผู้ดูแล"
 *
 * - ถ้าอีเมลนี้มีบัญชีอยู่แล้ว จะตั้ง custom claims เป็น admin ให้บัญชีเดิม (ไม่เปลี่ยนรหัสผ่าน)
 * - ไม่พิมพ์ค่าลับใด ๆ ออกหน้าจอ
 */
import { FieldValue } from "firebase-admin/firestore";
import { getAdmin } from "../src/lib/firebase/admin";
import { getSchoolId } from "../src/lib/firebase/config";

async function main() {
  const [email, password, displayName = "ผู้ดูแลระบบ"] = process.argv.slice(2);
  if (!email || !password) {
    console.error('วิธีใช้: npx tsx --env-file=.env.local scripts/create-admin.ts <email> <password> ["ชื่อ"]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_SCHOOL_ID) {
    console.warn('คำเตือน: ไม่ได้ตั้ง NEXT_PUBLIC_SCHOOL_ID — จะใช้ค่าเริ่มต้น "school-demo"');
  }
  const admin = await getAdmin();
  if (!admin) {
    console.error("ยังไม่ได้ตั้งค่า FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY");
    process.exit(1);
  }
  const schoolId = getSchoolId();

  let uid: string;
  let created = false;
  try {
    uid = (await admin.auth.getUserByEmail(email)).uid;
  } catch {
    uid = (await admin.auth.createUser({ email, password, displayName })).uid;
    created = true;
  }
  await admin.auth.setCustomUserClaims(uid, { schoolId, role: "admin" });
  await admin.db.doc(`users/${uid}`).set(
    {
      schoolId,
      role: "admin",
      displayName,
      email,
      disabled: false,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "scripts/create-admin",
    },
    { merge: true },
  );
  console.log(
    `${created ? "สร้างบัญชีใหม่" : "อัปเดตบัญชีเดิม"} สำเร็จ: uid=${uid} role=admin schoolId=${schoolId}\n` +
      "ผู้ใช้ต้องออกจากระบบแล้วเข้าใหม่ (หรือรอ token รีเฟรช) เพื่อให้สิทธิ์มีผล",
  );
}

main().catch((e) => {
  console.error("ล้มเหลว:", e instanceof Error ? e.message : e);
  process.exit(1);
});
