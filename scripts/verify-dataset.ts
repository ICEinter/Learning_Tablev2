import { createRayongDataset, createOfficialRayongTimetable } from "../src/data/rayong";
import { validate } from "../src/engine";

const ds = createRayongDataset();
const tt = createOfficialRayongTimetable(ds);
const v = validate(ds, tt.placements);

console.log("--------------------------------------------------");
console.log("สถานศึกษา:", ds.school.name, `(${ds.school.departmentName} รหัส ${ds.school.departmentCode})`);
console.log("ภาคเรียน:", `${ds.term.term}/${ds.term.year}`);
console.log("จำนวนครู:", ds.teachers.length, "ท่าน");
console.log("จำนวนกลุ่มเรียน:", ds.groups.length, "กลุ่ม (ปวช. 8 กลุ่ม, ปวส. 4 กลุ่ม รวม 12 กลุ่ม)");
console.log("จำนวนห้องเรียน:", ds.rooms.length, "ห้อง");
console.log("จำนวนรายวิชา:", ds.courses.length, "วิชา");
console.log("เกณฑ์ภาระสอน:", ds.workloadRules?.length, "เกณฑ์ (ครูปกติ ปวช. 18 / ปวส. 15, หน. ปวช. 12 / ปวส. 10)");
console.log("ผู้ลงนาม 4 ท่าน:", ds.school.signatories.map(s => `${s.title}: ${s.name}`).join(" | "));
console.log("--------------------------------------------------");
console.log("ผลการตรวจตารางทางการ อ.ปริญญา จำเนียรพล (33 ชม.):");
console.log("คะแนน Hard Violations:", v.score.hard);
console.log("คะแนน Soft Score:", v.score.soft);

const clashes = v.violations.filter(viol => viol.severity === "hard");

console.log("ข้อขัดแย้ง Hard ทั้งหมด:", clashes.length);
if (clashes.length > 0) {
  console.log("รายการขัดแย้ง:", clashes.slice(0, 5));
} else {
  console.log("✅ ไม่มีการชนกันของ ครู, ห้อง, กลุ่มเรียน หรือคาบพัก เลยแม้แต่รายการเดียว (Zero Clashes)!");
}
console.log("--------------------------------------------------");