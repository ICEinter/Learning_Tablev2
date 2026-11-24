import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, collection, writeBatch } from "firebase/firestore";
import { createRayongDataset, createOfficialRayongTimetable } from "../src/data/rayong";
import { encodePlacements, stripId } from "../src/shared/codec";

const cfg = {
  apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
  authDomain: "learning-time-2dba3.firebaseapp.com",
  projectId: "learning-time-2dba3"
};

async function seed() {
  console.log("=== เริ่มยิงข้อมูลเข้า Firestore Cloud จริง ===");
  const app = initializeApp(cfg, "seeder-run");
  const db = initializeFirestore(app, {}, 'test-db');

  const ds = createRayongDataset();
  const tt = createOfficialRayongTimetable(ds);
  const schoolId = "school-main";
  const termId = ds.term.id;

  // 1. สร้างเอกสาร School
  console.log("1. กำลังบันทึก School info...");
  await setDoc(doc(db, "schools", schoolId), {
    name: ds.school.name,
    departmentCode: ds.school.departmentCode,
    departmentName: ds.school.departmentName,
    regularEndTime: ds.school.regularEndTime,
    signatories: ds.school.signatories,
    activeTermId: termId,
    updatedAt: new Date().toISOString()
  });

  // 2. สร้างเอกสาร Term
  console.log("2. กำลังบันทึก Term info...");
  await setDoc(doc(db, "schools", schoolId, "terms", termId), {
    year: ds.term.year,
    term: ds.term.term,
    status: ds.term.status,
    publishedVersionId: tt.id,
    updatedAt: new Date().toISOString()
  });

  // 3. บันทึก Time Config
  console.log("3. กำลังบันทึก Time config...");
  await setDoc(doc(db, "schools", schoolId, "terms", termId, "config", "time"), ds.time);

  // 4. บันทึก Collections ย่อย (teachers, groups, rooms, courses, assignments)
  const collectionsToSeed = [
    { name: "teachers", data: ds.teachers },
    { name: "groups", data: ds.groups },
    { name: "rooms", data: ds.rooms },
    { name: "courses", data: ds.courses },
    { name: "assignments", data: ds.assignments },
    { name: "activities", data: ds.activities }
  ];

  for (const c of collectionsToSeed) {
    console.log(`4. กำลังบันทึก ${c.name} (${c.data.length} รายการ)...`);
    const batch = writeBatch(db);
    for (const item of c.data) {
      const ref = doc(db, "schools", schoolId, "terms", termId, c.name, item.id);
      batch.set(ref, item);
    }
    await batch.commit();
  }

  // 5. บันทึก Timetable ทางการของ อ.ปริญญา (Packed Timetable format)
  console.log("5. กำลังบันทึก Timetable ทางการ วท.ระยอง...");
  const packed = encodePlacements(tt.placements);
  await setDoc(doc(db, "schools", schoolId, "terms", termId, "timetables", tt.id), {
    ...stripId(tt),
    packed,
    updatedAt: new Date().toISOString()
  });

  // 6. บันทึก storage_files collection ตัวอย่าง
  console.log("6. กำลังสร้าง Collection 'storage_files'...");
  await setDoc(doc(db, "schools", schoolId, "storage_files", "sample_export_pdf"), {
    id: "sample_export_pdf",
    schoolId: schoolId,
    name: "ตารางสอน-อ.ปริญญา-2_2569.pdf",
    path: `schools/${schoolId}/timetable_pdf/sample_parinya.pdf`,
    url: "https://learning-time-2dba3.web.app/samples/parinya.pdf",
    contentType: "application/pdf",
    size: 154200,
    category: "timetable_pdf",
    termId: termId,
    timetableId: tt.id,
    createdAt: new Date().toISOString(),
    uploadedBy: "Admin"
  });

  console.log("\n✅ ยิงข้อมูลครบถ้วน 100%! กรุณากลับไปที่แท็บ Data ใน Firebase Console เพื่อดู Collection ได้เลยครับ!");
}

seed().catch(console.error);