import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, deleteDoc } from "firebase/firestore";
import { createRayongDataset, createOfficialRayongTimetable } from "../src/data/rayong";
import { encodePlacements, stripId } from "../src/shared/codec";

const cfg = {
  apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
  authDomain: "learning-time-2dba3.firebaseapp.com",
  projectId: "learning-time-2dba3"
};

async function reorg() {
  console.log("=== เริ่มสร้าง Document แยกตามหมวดหมู่ในช่องสีน้ำเงิน (Collection schools) ===");
  const app = initializeApp(cfg, "reorg-run");
  const db = initializeFirestore(app, {}, 'test-db');

  const ds = createRayongDataset();
  const tt = createOfficialRayongTimetable(ds);
  const packed = encodePlacements(tt.placements);

  // 1. หมวดข้อมูลสถานศึกษา -> schools/school-info
  console.log("-> สร้าง Document: schools/school-info");
  await setDoc(doc(db, "schools", "school-info"), {
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

  // 2. หมวดครูผู้สอน -> schools/teachers
  console.log("-> สร้าง Document: schools/teachers");
  await setDoc(doc(db, "schools", "teachers"), {
    teachers: ds.teachers,
    total: ds.teachers.length,
    updatedAt: new Date().toISOString()
  });

  // 3. หมวดรายวิชา -> schools/courses
  console.log("-> สร้าง Document: schools/courses");
  await setDoc(doc(db, "schools", "courses"), {
    courses: ds.courses,
    total: ds.courses.length,
    updatedAt: new Date().toISOString()
  });

  // 4. หมวดห้องเรียน -> schools/rooms
  console.log("-> สร้าง Document: schools/rooms");
  await setDoc(doc(db, "schools", "rooms"), {
    rooms: ds.rooms,
    total: ds.rooms.length,
    updatedAt: new Date().toISOString()
  });

  // 5. หมวดกลุ่มเรียน -> schools/groups
  console.log("-> สร้าง Document: schools/groups");
  await setDoc(doc(db, "schools", "groups"), {
    groups: ds.groups,
    total: ds.groups.length,
    updatedAt: new Date().toISOString()
  });

  // 6. หมวดมอบหมายสอน -> schools/assignments
  console.log("-> สร้าง Document: schools/assignments");
  await setDoc(doc(db, "schools", "assignments"), {
    assignments: ds.assignments,
    total: ds.assignments.length,
    updatedAt: new Date().toISOString()
  });

  // 7. หมวดตารางสอน -> schools/timetables
  console.log("-> สร้าง Document: schools/timetables");
  await setDoc(doc(db, "schools", "timetables"), {
    timetables: [
      {
        ...stripId(tt),
        id: tt.id,
        packed,
      }
    ],
    updatedAt: new Date().toISOString()
  });

  // 8. หมวดไฟล์จัดเก็บ -> schools/storage_files
  console.log("-> สร้าง Document: schools/storage_files");
  await setDoc(doc(db, "schools", "storage_files"), {
    storage_files: [
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

  // ลบ school-main อันเก่าออก เพื่อไม่ให้สับสน
  console.log("-> ลบ Document เก่า: schools/school-main");
  try {
    await deleteDoc(doc(db, "schools", "school-main"));
  } catch {}

  console.log("\n✅ สำเร็จ 100%! ในช่องสีน้ำเงินจะมี Document แยกเป็นหมวดๆ เรียบร้อยแล้วครับ");
}

reorg().catch(console.error);