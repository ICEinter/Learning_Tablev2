# ความปลอดภัย (Security)

## 1. Threat model (สรุป)

| ผู้คุกคาม / ความเสี่ยง | ตัวอย่าง | มาตรการ |
|---|---|---|
| ผู้ไม่ได้ login | อ่านตาราง/ข้อมูลนักเรียน | Rules: deny-by-default, ทุก path ต้อง `request.auth` + `schoolId` |
| ครู/นักเรียนที่อยากเห็นข้อมูลเกินสิทธิ์ | อ่านฉบับร่าง, ข้อมูลนักเรียนคนอื่น, แก้ข้อมูลหลัก | Rules แยกตาม role; ตารางอ่านได้เฉพาะ `status == 'published'`; students อ่านได้เฉพาะของตนเอง |
| ผู้ใช้ปลอมบทบาท | แก้ claims ฝั่ง client | claims ตั้งได้จาก trusted server เท่านั้น (Admin SDK หรือ Identity Toolkit REST); ตรวจซ้ำทั้งใน Rules และ `requireUser()` |
| ข้ามสถานศึกษา | admin โรงเรียน B อ่านโรงเรียน A | ทุก rule ตรวจ `token.schoolId == {schoolId ใน path}`; server ตรวจ `claims.schoolId === NEXT_PUBLIC_SCHOOL_ID` |
| client ส่งตารางที่ผิดเงื่อนไข | เผยแพร่ตารางที่ครูชนกัน | client เขียนตารางตรงไม่ได้ (`allow write: if false`); server รัน validator ซ้ำทุกครั้ง และเผยแพร่ได้เฉพาะ Hard = 0 |
| แก้ไขพร้อมกัน | admin สองคนบันทึกทับกัน | optimistic concurrency ด้วย `updatedAt` (409 เมื่อไม่ตรง) |
| payload ใหญ่/ผิดรูปแบบ | DoS ผ่าน JSON ขนาดใหญ่ | จำกัด 2 MB, ตรวจด้วย Zod, จำกัดจำนวน placements |
| ความลับรั่ว | private key อยู่ใน repo/log | env เท่านั้น, ไม่ log, ไม่ส่งรายละเอียด error ภายในกลับ client |

## 2. Firebase client config ไม่ใช่ความลับ

ค่า `NEXT_PUBLIC_FIREBASE_*` (รวม apiKey) ถูกฝังใน JavaScript ที่ส่งให้เบราว์เซอร์ — **ทุกคนเห็นได้**
มันเป็นเพียงตัวระบุ project ไม่ใช่กลไกควบคุมสิทธิ์ สิทธิ์จริงมาจาก:
1. Firebase Authentication (ยืนยันตัวตน)
2. Custom claims (บทบาท)
3. Firestore Security Rules (บังคับที่ฐานข้อมูล)
4. การตรวจฝั่ง server ใน Route Handlers

ค่าที่ถูกปิดบัง (เช่น `AIza****`) ระบบถือว่า "ยังไม่ได้ตั้งค่า" และใช้โหมดสาธิตแทน — ห้ามสร้างค่าขึ้นเอง

## 3. Custom claims

`{ schoolId, role: 'admin'|'teacher'|'student', teacherId?, studentId?, groupIds? }` (เพดาน 1,000 bytes)
- ตั้งโดย `POST /api/admin/users` (ต้องเป็น admin), `scripts/create-admin.ts` (คนแรก), หรือ `scripts/set-user-claims.ts` (บัญชีเดิม)
- `groupIds` ของนักเรียนคำนวณจาก `students/{id}.groupId` ฝั่ง server — ไม่รับจาก body
- client อ่าน claims เพื่อแสดงผล (`claimsToSession`) เท่านั้น ผู้ใช้ที่ไม่มี role หรือ schoolId ไม่ตรง → ไม่ได้ session
- ตอน login/คืน session ระบบบังคับรีเฟรช token (`getIdToken(true)`) และตรวจ `schoolId` ก่อนสร้าง session
- หลังเปลี่ยน claims ของบัญชีเดิม ผู้ใช้ต้อง login ใหม่หรือบังคับรีเฟรช token

## 4. Firestore Security Rules (`firestore.rules`)

- deny-by-default; helper `inSchool / isAdmin / isTeacher / isStudent / myGroup`
- admin เขียนข้อมูลหลักได้ (courses, teachers, rooms, groups, assignments, activities, config, students)
  - เอกสาร school/term จำกัดฟิลด์ด้วย `keys().hasOnly(...)` และ `publishedVersionId` แก้ได้เฉพาะ server
- **server เท่านั้น** (Admin SDK): `timetables`, `views`, `solverJobs`, `importBatches`, `auditLog`, `users`
- `timetables`: admin อ่านทุกสถานะ; สมาชิกอื่นอ่านได้เฉพาะ `status == 'published'` (ฉบับร่างมองไม่เห็น)
- `views`: ครูอ่าน `t_{teacherId}` ของตน, นักเรียนอ่าน `g_{groupId}` ของกลุ่มตน — และต้องเป็นเวอร์ชันที่เผยแพร่แล้ว (ตรวจด้วย `get()` เอกสารแม่)
- `students` / `enrollments`: admin หรือเจ้าของ (`claims.studentId`) เท่านั้น
- ข้อมูลหลักที่จำเป็นต่อการแสดงตาราง (courses/teachers/rooms/groups/assignments/activities/config) อ่านได้โดยสมาชิกของสถานศึกษา
- ทดสอบใน `tests/rules/firestore.rules.test.ts` (5 บทบาท: admin, teacher, student, admin โรงเรียนอื่น, ไม่ login)
  — **ยังไม่ได้รันในเครื่องพัฒนา** (เครื่องมี Java 8 แต่ Emulator ต้องการ Java 11+) รันใน CI job `rules`

ข้อจำกัดที่ทราบ: rules ยังไม่ตรวจ schema ระดับฟิลด์ของข้อมูลหลัก (พึ่ง Zod ใน UI) — admin ที่ตั้งใจเขียนข้อมูลผิดรูปแบบผ่าน SDK ได้ ซึ่งยอมรับได้เพราะ admin เป็นผู้ที่ไว้ใจได้ และ server ตรวจ validator ก่อนเผยแพร่ทุกครั้ง

## 5. การตรวจฝั่ง server (`src/lib/auth/server.ts`)

- `requireUser(req, roles)` → `verifyIdToken(token, checkRevoked = true)` → ตรวจ role และ `claims.schoolId === getSchoolId()`
- ไม่เชื่อ `schoolId`/`termId` จาก body — ใช้ค่าจาก env + `activeTermId` ในฐานข้อมูล
- error รูปแบบเดียว `{ error, details? }`; 401 (ไม่มี/ผิด token), 403 (ไม่มีสิทธิ์), 503 (ยังไม่ตั้งค่า Admin), 500 ไม่เปิดเผยรายละเอียดภายใน
- `/api/validate` อนุญาตแบบไม่ login เฉพาะโหมดสาธิต (ไม่มีทั้ง client และ admin config) เพราะเป็นการคำนวณล้วน

## 6. การจัดการความลับ

- service account เก็บเป็น Worker/Server Secrets 3 ตัว (`FIREBASE_ADMIN_*` หรือ aliases ที่ระบุใน `.env.example`) — ไม่มี prefix `NEXT_PUBLIC_` จึงไม่ถูกส่งไปเบราว์เซอร์
- `src/lib/firebase/admin.ts` มี runtime guard ป้องกันการถูก import ฝั่ง client (แพ็กเกจ `server-only` ไม่ได้ติดตั้ง) และ ESLint ห้ามไฟล์ client import `firebase-admin`
- ไม่ log ค่า env ใด ๆ; `.env*.local` อยู่ใน `.gitignore`; บน Netlify ตั้งใน UI ไม่ใช่ `netlify.toml`
- หากสงสัยว่า private key รั่ว: ลบ key ใน Google Cloud Console → IAM → Service accounts แล้วสร้างใหม่

## 7. ลดข้อมูลส่วนบุคคล (PII minimisation)

- `Student` เก็บเฉพาะ `code, displayName, groupId, extraAssignmentIds` — ไม่มีเลขบัตร วันเกิด ที่อยู่ เบอร์โทร
- ข้อมูลนักเรียนอยู่ที่ `schools/{s}/students` อ่านได้เฉพาะ admin และเจ้าของ
- `users/{uid}` เก็บ email/displayName/role เท่าที่จำเป็น เขียนโดย server เท่านั้น

## 8. การควบคุมต้นทุน reads/writes

- ตาราง 1 เวอร์ชัน = **1 document** (packed `entries` + `dict`, ~35 KiB สำหรับ 1,800 คาบ — วัดจาก `tests/codec`)
- ไม่มี realtime listener กับข้อมูลจำนวนมาก; โหลดครั้งเดียวด้วย `getDocs` + persistent cache (IndexedDB) + cache ในหน่วยความจำ 30 วินาที
- หลังเขียน repository อัปเดต cache เฉพาะส่วนที่เปลี่ยน (ไม่อ่านใหม่ทั้งชุด)
- ครู/นักเรียนอ่านตารางที่เผยแพร่ด้วย query `status == 'published' limit 1`
- batch ละไม่เกิน 450 ops; field overrides ปิด index ของฟิลด์ใหญ่ (`entries`, `dict`, `rows`, ...)
- การบันทึกฉบับร่างไม่เขียน audit log (ลด writes) — audit เฉพาะการเผยแพร่ ลบตาราง และสร้างผู้ใช้
