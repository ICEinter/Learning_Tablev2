# คู่มือ Deploy (GitHub → Netlify + Firebase)

> หากต้องการ deploy แอป Next.js นี้บน Cloudflare Workers ให้ใช้ [คู่มือ Cloudflare Workers](./CLOUDFLARE.md) ซึ่งเพิ่มภายหลังจากแผน Netlify เดิม

> สถานะ: ขั้นตอนนี้ **ยังไม่เคยถูกรันกับ Firebase project / Netlify site จริง** เพราะยังไม่ได้รับค่า config จริง
> ทุกขั้นตอนที่ต้องใช้บัญชีของคุณ (สร้าง project, deploy rules, ตั้ง env) ต้องทำโดยเจ้าของบัญชี

## 0. โหมดการทำงาน

| โหมด | เงื่อนไข | ข้อมูลเก็บที่ |
|---|---|---|
| สาธิต (demo) | ผู้ใช้เลือก “ทดลองระบบก่อนสมัคร” เอง ใช้ได้แม้มี Firebase config | `localStorage` ของเบราว์เซอร์ และไม่ใช้บัญชีจริง |
| Firebase | ผู้ใช้เลือกเข้าสู่ระบบ/สมัครสมาชิก และตั้งค่า client config ครบ | Firebase Authentication + Cloud Firestore |

หากไม่ได้ตั้ง Firebase ระบบจะแสดงแบบฟอร์มปกติพร้อมแจ้งให้ตั้งค่าก่อนสมัคร/เข้าสู่ระบบ; Demo ต้องเลือกแยกเองและไม่ถูกใช้แทนบัญชีจริง

## 1. เตรียม Firebase project

1. เข้า [Firebase Console](https://console.firebase.google.com) → **Add project**
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**
3. **Build → Firestore Database → Create database** (production mode, region ที่ใกล้ เช่น `asia-southeast1`)
4. **Project settings → General → Your apps → Web app (`</>`)** → คัดลอกค่า config ไปใส่ `NEXT_PUBLIC_FIREBASE_*`
5. **Project settings → Service accounts → Generate new private key** → ได้ไฟล์ JSON
   - ใช้ 3 ค่า: `project_id` → `FIREBASE_ADMIN_PROJECT_ID`, `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`, `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY`
   - **ห้าม commit ไฟล์ JSON นี้** เก็บในที่ปลอดภัยแล้วลบออกจากเครื่องเมื่อใส่ค่าเสร็จ
6. ตั้ง `NEXT_PUBLIC_SCHOOL_ID` เป็นรหัสสถานศึกษา (เช่น `tech-college-01`) — ใช้เป็น path `schools/{schoolId}` และต้องตรงกับ claim `schoolId`

## 2. ตั้งค่าในเครื่อง

```bash
cp .env.example .env.local   # แล้วใส่ค่าจริง
npm run dev
```

ตรวจสถานะได้ที่ `GET /api/health` → `{ firebaseClientConfigured, firebaseAdminConfigured, emulator, time }` (ไม่มีค่าลับ)

## 3. Deploy Security Rules และ Indexes

```bash
cp .firebaserc.example .firebaserc       # แก้ project id เป็นของจริง
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

> ก่อน deploy rules ควรให้ CI job `rules` ผ่าน (ทดสอบ rules บน Emulator)

## 4. สร้างผู้ดูแลระบบคนแรก

ผู้ใช้ทุกคนต้องมี custom claims `{ schoolId, role }` ซึ่งตั้งได้เฉพาะฝั่ง server ที่เชื่อถือได้ — คนแรกใช้สคริปต์:

```bash
npx tsx --env-file=.env.local scripts/create-admin.ts admin@example.com "รหัสผ่านอย่างน้อย8ตัว" "ชื่อผู้ดูแล"
```

ถ้าต้องอัปเดตสิทธิ์ของบัญชีที่มีอยู่แล้ว ใช้ UID จาก Firebase Authentication:

```bash
npx tsx --env-file=.env.local scripts/set-user-claims.ts <uid> <admin|teacher|student> [schoolId]
```

ถ้าไม่ส่ง `schoolId` สคริปต์จะใช้ `NEXT_PUBLIC_SCHOOL_ID`; หลังเปลี่ยนสิทธิ์ ผู้ใช้ต้องเข้าสู่ระบบใหม่ สคริปต์นี้ไม่รับรหัสผ่านและไม่เปลี่ยนรหัสผ่าน

จากนั้นเข้าสู่ระบบด้วยบัญชีนี้ → ไปที่หน้าตั้งค่า กด **บันทึก** (หรือ "รีเซ็ตเป็นข้อมูลจำลอง") เพื่อสร้างเอกสาร
`schools/{schoolId}` + ภาคเรียน + โครงสร้างเวลา ครั้งแรก
บัญชีครู/นักเรียนสร้างผ่าน `POST /api/admin/users` (admin เท่านั้น)

## 5. GitHub

1. สร้าง repository แล้ว push โค้ด (ตรวจว่า `.env.local` ไม่ถูก commit — อยู่ใน `.gitignore`)
2. GitHub Actions (`.github/workflows/ci.yml`) จะรัน:
   - `quality`: `npm ci` → lint → typecheck → test → build (ไม่มี Firebase env = โหมดสาธิต)
   - `rules`: ติดตั้ง Java 21 → `firebase-tools emulators:exec` รัน `tests/rules` บน Firestore Emulator
3. แนะนำตั้ง branch protection ให้ `main` ต้องผ่าน CI ก่อน merge

## 6. Netlify

1. Netlify → **Add new site → Import an existing project → GitHub** → เลือก repo
2. Build settings มาจาก `netlify.toml` อยู่แล้ว: `npm run build`, publish `.next`, plugin `@netlify/plugin-nextjs`, Node 22
3. **Site configuration → Environment variables** — ใส่ทุกค่าจาก `.env.example` (scope: Builds + Functions)
   - `FIREBASE_ADMIN_PRIVATE_KEY`: วางทั้งก้อนแบบ `\n` escaped บรรทัดเดียว (โค้ดแปลง `\\n` → newline ให้)
   - **ห้าม** ใส่ค่าเหล่านี้ใน `netlify.toml` หรือไฟล์ใด ๆ ใน repo
   - ค่า `NEXT_PUBLIC_*` ถูกฝังตอน build — แก้แล้วต้อง **Trigger deploy** ใหม่
4. Deploy → ได้โดเมน `https://<site>.netlify.app`

## 7. Authorized domains

Firebase Console → **Authentication → Settings → Authorized domains → Add domain**:
- `<site>.netlify.app` และโดเมนจริง (ถ้ามี)
- โดเมน deploy preview ถ้าต้องการทดสอบ login ใน preview

## 8. Smoke test หลัง deploy

1. `GET https://<site>/api/health` → ทั้งสองค่าเป็น `true`
2. Login admin → แก้ข้อมูลหลัก → สร้างตาราง → บันทึก (ผ่าน `POST /api/timetables`) → เผยแพร่ (Hard ต้องเป็น 0)
3. Login ครู/นักเรียน → เห็นเฉพาะตารางที่เผยแพร่
4. Export PDF/Excel

## 9. ข้อจำกัดที่ทราบ

- Route Handler บน Netlify มี timeout 60 วินาที — solver จึงรันในเบราว์เซอร์ (Web Worker) เป็นค่าเริ่มต้น
- `netlify/functions/solve-background.mts` เป็นทางเลือก (≤ 15 นาที) **ยังไม่ได้ทดสอบบน Netlify จริง**
- ขนาด bundle/cold start ของ `firebase-admin` บน Netlify ยังไม่ได้วัด
