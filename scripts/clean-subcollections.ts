import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, deleteDoc, getDocs, collection } from "firebase/firestore";
import { createRayongDataset, createOfficialRayongTimetable } from "../src/data/rayong";
import { encodePlacements, stripId } from "../src/shared/codec";

const cfg = {
  apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
  authDomain: "learning-time-2dba3.firebaseapp.com",
  projectId: "learning-time-2dba3"
};

async function clean() {
  console.log("=== เริ่มล้าง Sub-collections และจัดเก็บในเอกสารเดียว ===");
  const app = initializeApp(cfg, "cleaner");
  const db = initializeFirestore(app, {}, 'test-db');
  const schoolId = "school-main";
  const ds = createRayongDataset();
  const tt = createOfficialRayongTimetable(ds);
  const packed = encodePlacements(tt.placements);

  // 1. ลบเอกสารใน Sub-collections เดิม (terms, storage_files)
  const termId = ds.term.id;
  const subCols = ["courses", "teachers", "rooms", "groups", "assignments", "activities", "timetables"];
  for (const c of subCols) {
    try {
      const snap = await getDocs(collection(db, "schools", schoolId, "terms", termId, c));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    } catch {}
  }

  try {
    const configSnap = await getDocs(collection(db, "schools", schoolId, "terms", termId, "config"));
    for (const d of configSnap.docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db, "schools", schoolId, "terms", termId));
  } catch {}

  try {
    const storSnap = await getDocs(collection(db, "schools", schoolId, "storage_files"));
    for (const d of storSnap.docs) await deleteDoc(d.ref);
  } catch {}

  // 2. เขียนทับเอกสาร schools/school-main แบบ Clean 100%
  // ไม่ใช้ merge เพื่อลบการอ้างอิง sub-collection ออกให้หมด
  const cleanSchoolData = {
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

    // ข้อมูลทั้งหมดอยู่ในนี้โดยตรง (ไม่มี sub-collection ใดๆ)
    teachers: ds.teachers,
    courses: ds.courses,
    rooms: ds.rooms,
    groups: ds.groups,
    assignments: ds.assignments,
    activities: ds.activities || [],
    workloadRules: ds.workloadRules || [],
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

  await setDoc(doc(db, "schools", schoolId), cleanSchoolData);
  console.log("✅ ลบ Sub-collections สำเร็จเรียบร้อย! คอลัมน์ที่ 3 จะไม่มีคำว่า storage_files หรือ terms อีกต่อไป");
}

clean().catch(console.error);