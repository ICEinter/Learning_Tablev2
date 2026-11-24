# Firebase — โครงสร้างข้อมูลที่ใช้งานจริง

เอกสารนี้อธิบาย path/ฟิลด์ที่โค้ด **ใช้อยู่จริง** (ต่างจากร่างใน DEVELOPMENT_PLAN.md บางจุด)
helper ของ path อยู่ที่ `src/shared/codec.ts` (`fsPaths`) ใช้ร่วมกันทั้ง client และ server

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/firebase/config.ts` | อ่าน `NEXT_PUBLIC_*`, `isFirebaseConfigured()`, `getSchoolId()`, `useEmulator()` |
| `src/lib/firebase/client.ts` | client SDK singleton (Auth + Firestore + persistent cache + emulator) |
| `src/lib/firebase/admin.ts` | Admin SDK (`getAdmin()`, `isAdminConfigured()`) ฝั่ง server |
| `src/lib/auth/firebase-auth.ts` | sign-in/out, `onFirebaseSession`, `getIdToken`, `authedFetch` |
| `src/lib/auth/server.ts` | `requireUser`, `HttpError`, `jsonError`, `readJson` |
| `src/lib/store/firestore-repository.ts` | `Repository` โหมด Firebase |
| `src/shared/codec.ts` | packed codec + mapping เอกสาร ⇄ domain types |
| `src/app/api/**` | Route Handlers (Node runtime) |
| `firestore.rules`, `firestore.indexes.json`, `firebase.json` | rules / indexes / emulator |

## Collection tree

```
users/{uid}                                       server เท่านั้น: { schoolId, role, teacherId?, studentId?, displayName, email, disabled, createdAt, createdBy }
schools/{schoolId}                                { name, regularEndTime, signatories[], timezone, activeTermId }
  students/{studentId}                            { code, displayName, groupId, extraAssignmentIds[] }   (PII ขั้นต่ำ)
  auditLog/{autoId}                               server เท่านั้น: { at, actorUid, action, entityType, entityId, termId?, diff? }
  terms/{termId}                                  { year, term, status, publishedVersionId? }
    config/time                                   TimeStructure { days[], periods[], preActivity? }
    courses/{id}  teachers/{id}  rooms/{id}       ฟิลด์ตาม src/shared/types.ts (ไม่เก็บ id ซ้ำในเอกสาร)
    groups/{id}   assignments/{id}  activities/{id}
    timetables/{versionId}                        server เท่านั้น (TimetableDoc ด้านล่าง)
      views/{g_<groupId>|t_<teacherId>|r_<roomId>} server เท่านั้น: { kind, refId, versionId, rows[], summary }
    solverJobs/{jobId}                            server เท่านั้น (ใช้โดย netlify/functions/solve-background — ทางเลือก)
```

- ข้อมูลที่ solver ใช้อยู่ใต้ term; นักเรียน/ผู้ใช้/audit อยู่ระดับสถานศึกษา
- `activeTermId` ในเอกสาร school กำหนดภาคเรียนที่แอปโหลด (ถ้าไม่มีใช้ id ภาคเรียนของข้อมูลจำลอง)
- `enrollments`, `academicYears`, `importBatches` มี rules รองรับแล้วแต่โค้ดยังไม่ได้ใช้

## TimetableDoc (packed — 1 เอกสารต่อเวอร์ชัน)

```ts
{
  termId, label, status: 'draft'|'published'|'archived',
  dict: { a: assignmentId[], r: roomId[] },
  entries: "aIdx.block.day.period.rIdx;aIdx.block.day.period.rIdx;...",
  entryCount, hardViolations, softScore,
  metrics: { hard, soft, elapsedMs? },     // คำนวณโดย validator ฝั่ง server เสมอ
  source: { algorithm, seed?, jobId? }, note?,
  createdAt, updatedAt, createdBy?,        // ISO string; updatedAt ใช้ทำ optimistic concurrency
  publishedAt?, publishedBy?
}
```
ขนาดวัดจาก `tests/codec`: 1,800 entries ≈ 35 KiB (เพดาน Firestore 1 MiB; server ปฏิเสธเกิน 900 KiB)

## View rows (เขียนตอนเผยแพร่)

`{ d, p, len, course, courseName, teacher, groups, room, assignmentId }` เรียงตามวัน/คาบ
rules อนุญาตให้ครู/นักเรียนอ่าน view ของตนได้เมื่อเวอร์ชันแม่ `status == 'published'` เท่านั้น

## ใครอ่าน/เขียนอะไร (repository ฝั่ง client)

| บทบาท | load() อ่าน | เขียน |
|---|---|---|
| admin | school, term, config/time, 6 collections ของ term, students ทั้งหมด, timetables ทั้งหมด | ข้อมูลหลักผ่าน client SDK (batch ≤ 450); ตารางผ่าน API |
| teacher | school, term, config/time, 6 collections ของ term, timetable ที่เผยแพร่ (`where status == published limit 1`) | — |
| student | เหมือนครู + `students/{claims.studentId}` ของตนเองเท่านั้น | — |
| ไม่ login | ไม่อ่านฐานข้อมูล (คืนชุดข้อมูลว่าง) | — |

- ฐานข้อมูลว่าง (ยังไม่มี `schools/{schoolId}`): คืนชุดข้อมูลว่างที่ถูกต้อง โดยใช้ school/term/time เริ่มต้นจากข้อมูลจำลอง
  และจะเขียนลงฐานข้อมูลเมื่อ admin บันทึกครั้งแรก หรือกด "รีเซ็ตเป็นข้อมูลจำลอง" (`replaceAll`) เท่านั้น
- `replaceAll` ไม่ลบตารางเดิม (client ไม่มีสิทธิ์) — ลบผ่าน `DELETE /api/timetables/{id}`
- cache ในหน่วยความจำ 30 วินาที; การเขียนอัปเดต cache โดยตรง

## API (Route Handlers, `runtime = "nodejs"`)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/api/health` | ทุกคน | สถานะการตั้งค่า ไม่มีค่าลับ |
| POST | `/api/validate` | admin (โหมดสาธิต: ไม่ต้อง login) | body `{ dataset, placements }` ≤ 2 MB → `ValidationResult` |
| POST | `/api/timetables` | admin | body `{ timetable, expectedUpdatedAt? }` — status ต้องเป็น draft; server โหลด dataset เอง → validate → เก็บ packed; 409 เมื่อ `updatedAt` ไม่ตรง |
| POST | `/api/timetables/{id}/publish` | admin | validate ซ้ำ → 422 ถ้า Hard > 0 → เขียน views → transaction (published / archive ฉบับเดิม / `term.publishedVersionId` / auditLog) |
| DELETE | `/api/timetables/{id}` | admin | ห้ามลบฉบับที่เผยแพร่ (409); ลบ views ด้วย |
| GET | `/api/admin/users?after=<uid>` | admin | รายชื่อผู้ใช้ของสถานศึกษา หน้าละ 200 |
| POST | `/api/admin/users` | admin | `{ email, password(≥8), displayName, role, teacherId?, studentId? }` → Auth user + claims + `users/{uid}` |

รูปแบบ error: `{ error: "<ข้อความภาษาไทย>", details? }`

## Emulator

`firebase.json`: auth 9099, firestore 8080, UI ปิด — ตั้ง `NEXT_PUBLIC_USE_EMULATOR=true` (client) และ
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` (server)
ต้องใช้ Java 11+ (เครื่องพัฒนาปัจจุบันมี Java 8 จึงรันไม่ได้ — ใช้ CI)

## Indexes (`firestore.indexes.json`)

composite ตาม DEVELOPMENT_PLAN 4.6 (ปรับชื่อฟิลด์ให้ตรง schema จริง) และ field overrides ปิด index ของ
`timetables.entries/dict`, `views.rows`, `solverJobs.logTail/params`, `importBatches.errors`, `auditLog.diff`,
`teachers.unavailable/preferredOff`, `rooms.unavailable`, `config.periods`
query ที่โค้ดใช้จริงตอนนี้ (`status ==` เดี่ยว, `schoolId ==` + order by documentId) ใช้ single-field index อัตโนมัติ
