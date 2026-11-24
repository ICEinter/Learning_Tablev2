import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc } from "firebase/firestore";
import { createRayongDataset, createOfficialRayongTimetable } from "../src/data/rayong";
import { encodePlacements, stripId } from "../src/shared/codec";

const cfg = {
  apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
  authDomain: "learning-time-2dba3.firebaseapp.com",
  projectId: "learning-time-2dba3"
};

async function createSplitDocs() {
  console.log("=== กำลังสร้าง Document แยกใน Collection 'schools' ===");
  const app = initializeApp(cfg, "seeder-split");
  const db = initializeFirestore(app, {}, 'test-db');

  const ds = createRayongDataset();
  const tt = createOfficialRayongTimetable(ds);
  const packed = encodePlacements(tt.placements);

  // 1. Document "info" (ข้อมูลสถานศึกษา)
  console.log("สร้าง doc: schools/info");
  await setDoc(doc(db, "schools", "info"), {
    name: ds.school.name,
    departmentCode: ds.school.departmentCode || "901",
    departmentName: ds.school.departmentName || "เทคโนโลยีสารสนเทศและการสื่อสาร",
    regularEndTime: ds.school.regularEndTime,
    signatories: ds.school.signatories,
    term: {
      year: ds.term.year,
      term: ds.term.term,
      status: ds.term.status,
    },
    time: ds.time,
    workloadRules: ds.workloadRules || [],
    updatedAt: new Date().toISOString()
  });

  // 2. Document "teachers" (ครู 10 ท่าน)
  console.log("สร้าง doc: schools/teachers");
  await setDoc(doc(db, "schools", "teachers"), {
    list: ds.teachers,
    count: ds.teachers.length,
    updatedAt: new Date().toISOString()
  });

  // 3. Document "courses" (วิชา 36 รายการ)
  console.log("สร้าง doc: schools/courses");
  await setDoc(doc(db, "schools", "courses"), {
    list: ds.courses,
    count: ds.courses.length,
    updatedAt: new Date().toISOString()
  });

  // 4. Document "rooms" (ห้อง 8 ห้อง)
  console.log("สร้าง doc: schools/rooms");
  await setDoc(doc(db, "schools", "rooms"), {
    list: ds.rooms,
    count: ds.rooms.length,
    updatedAt: new Date().toISOString()
  });

  // 5. Document "groups" (กลุ่มเรียน 12 กลุ่ม)
  console.log("สร้าง doc: schools/groups");
  await setDoc(doc(db, "schools", "groups"), {
    list: ds.groups,
    count: ds.groups.length,
    updatedAt: new Date().toISOString()
  });

  // 6. Document "assignments" (มอบหมายสอน 48 รายการ)
  console.log("สร้าง doc: schools/assignments");
  await setDoc(doc(db, "schools", "assignments"), {
    list: ds.assignments,
    count: ds.assignments.length,
    updatedAt: new Date().toISOString()
  });

  // 7. Document "timetables" (ตารางสอนทางการ 33 ชม.)
  console.log("สร้าง doc: schools/timetables");
  await setDoc(doc(db, "schools", "timetables"), {
    list: [
      {
        ...stripId(tt),
        id: tt.id,
        packed,
      }
    ],
    updatedAt: new Date().toISOString()
  });

  // 8. Document "storage_files" (ประวัติไฟล์ Firebase Storage)
  console.log("สร้าง doc: schools/storage_files");
  await setDoc(doc(db, "schools", "storage_files"), {
    list: [
      {
        id: "sample_export_pdf",
        name: "ตารางสอน-อ.ปริญญา-2_2569.pdf",
        category: "timetable_pdf",
        url: "https://learning-time-2dba3.web.app/samples/parinya.pdf",
        contentType: "application/pdf",
        size: 154200,
        createdAt: new Date().toISOString(),
        uploadedBy: "Admin"
      }
    ],
    updatedAt: new Date().toISOString()
  });

  console.log("\n✅ สร้าง Document แยกในช่องสีน้ำเงินสำเร็จเรียบร้อย 100%!");
}

createSplitDocs().catch(console.error);