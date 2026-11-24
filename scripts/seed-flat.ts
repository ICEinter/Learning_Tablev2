import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc } from "firebase/firestore";
import { createRayongDataset, createOfficialRayongTimetable } from "../src/data/rayong";
import { encodePlacements, stripId } from "../src/shared/codec";

const cfg = {
  apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
  authDomain: "learning-time-2dba3.firebaseapp.com",
  projectId: "learning-time-2dba3"
};

async function seedFlat() {
  console.log("=== กำลังบันทึกข้อมูลแบบรวมใน Document เดียว (ไม่มี Sub-collection) ===");
  const app = initializeApp(cfg, "seeder-flat");
  const db = initializeFirestore(app, {});

  const ds = createRayongDataset();
  const tt = createOfficialRayongTimetable(ds);
  const schoolId = "school-main";
  const packed = encodePlacements(tt.placements, ds);

  // รวมทุกอย่างไว้ใน Document 'schools/school-main' โดยตรง
  const schoolDocData = {
    // ข้อมูลสถานศึกษา
    name: ds.school.name,
    departmentCode: ds.school.departmentCode || "901",
    departmentName: ds.school.departmentName || "เทคโนโลยีสารสนเทศและการสื่อสาร",
    regularEndTime: ds.school.regularEndTime,
    signatories: ds.school.signatories,
    
    // โครงสร้างเวลาและภาคเรียน
    term: {
      year: ds.term.year,
      term: ds.term.term,
      status: ds.term.status,
    },
    time: ds.time,

    // ข้อมูลหลัก: ครู, วิชา, ห้อง, กลุ่มเรียน, มอบหมายสอน
    teachers: ds.teachers,
    courses: ds.courses,
    rooms: ds.rooms,
    groups: ds.groups,
    assignments: ds.assignments,
    activities: ds.activities || [],
    workloadRules: ds.workloadRules || [],

    // ตารางสอนทางการของ อ.ปริญญา และไฟล์ Storage
    timetables: [
      {
        ...stripId(tt),
        id: tt.id,
        packed,
      }
    ],
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
  };

  console.log("กำลังบันทึกลง Firestore ที่ doc: schools/school-main ...");
  await setDoc(doc(db, "schools", schoolId), schoolDocData);
  console.log("✅ บันทึกสำเร็จ 100%! ข้อมูลทั้งหมด (teachers, courses, rooms, groups, timetables, storage_files) อยู่ใน document เดียวกันแล้ว");
}

seedFlat().catch(console.error);