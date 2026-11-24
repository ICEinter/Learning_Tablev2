/**
 * สคริปต์ลบข้อมูลใน collection เดิมออกทั้งหมด แล้วบรรจุข้อมูลชุดวิทยาลัยเทคนิคระยองตามไฟล์แนบลง Firestore
 * รองรับทั้ง Admin SDK และ Client SDK (ใช้ข้อมูลโปรเจกต์จาก .env.local)
 *
 * วิธีใช้:
 *   npx tsx --env-file=.env.local scripts/seed-firestore.ts
 */
import { getAdmin } from "../src/lib/firebase/admin";
import { getClientDb } from "../src/lib/firebase/client";
import { getSchoolId, isFirebaseConfigured } from "../src/lib/firebase/config";
import { createRayongDataset, createOfficialRayongTimetable } from "../src/data/rayong";
import { encodePlacements, stripId } from "../src/shared/codec";
import type { Dataset, TimetableVersion } from "../src/shared/types";
import { collection, doc, getDocs, writeBatch, type Firestore } from "firebase/firestore";

export async function wipeAndSeedFirestore(dataset: Dataset = createRayongDataset(), officialTt?: TimetableVersion) {
  const schoolId = getSchoolId();
  const termId = dataset.term.id;
  console.log(`[Wipe & Seed] เริ่มต้นล้างข้อมูลเดิมและนำเข้าข้อมูลชุด วท.ระยอง`);
  console.log(`  School ID: ${schoolId}`);
  console.log(`  Term ID:   ${termId}`);

  // ลองใช้ Admin SDK ก่อน ถ้าไม่มีใช้ Client SDK
  const admin = await getAdmin().catch(() => null);

  if (admin) {
    console.log("  โหมดเชื่อมต่อ: Firebase Admin SDK");
    const db = admin.db;
    const subCols = ["courses", "teachers", "rooms", "groups", "assignments", "activities", "timetables"];
    for (const col of subCols) {
      const snap = await db.collection(`schools/${schoolId}/terms/${termId}/${col}`).limit(200).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    const studentSnap = await db.collection(`schools/${schoolId}/students`).limit(200).get();
    if (!studentSnap.empty) {
      const batch = db.batch();
      studentSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // เขียนข้อมูลใหม่
    await db.doc(`schools/${schoolId}`).set({
      name: dataset.school.name,
      departmentCode: dataset.school.departmentCode ?? "901",
      departmentName: dataset.school.departmentName ?? "เทคโนโลยีสารสนเทศและการสื่อสาร",
      regularEndTime: dataset.school.regularEndTime,
      signatories: dataset.school.signatories,
      activeTermId: termId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await db.doc(`schools/${schoolId}/terms/${termId}`).set({
      year: dataset.term.year,
      term: dataset.term.term,
      status: dataset.term.status,
      publishedVersionId: officialTt ? officialTt.id : "tt-rayong-official",
      updatedAt: new Date().toISOString(),
    });

    await db.doc(`schools/${schoolId}/terms/${termId}/config/time`).set(dataset.time);
    await db.doc(`schools/${schoolId}/terms/${termId}/config/workloadRules`).set({ rules: dataset.workloadRules ?? [] });

    for (const col of ["teachers", "groups", "rooms", "courses", "assignments", "activities"] as const) {
      const items = dataset[col];
      if (!items || items.length === 0) continue;
      const batch = db.batch();
      for (const item of items) {
        batch.set(db.doc(`schools/${schoolId}/terms/${termId}/${col}/${item.id}`), stripId(item));
      }
      await batch.commit();
      console.log(`  ✓ บันทึก ${col} (${items.length} รายการ)`);
    }

    if (dataset.students.length > 0) {
      const batch = db.batch();
      for (const s of dataset.students) {
        batch.set(db.doc(`schools/${schoolId}/students/${s.id}`), stripId(s));
      }
      await batch.commit();
      console.log(`  ✓ บันทึก students (${dataset.students.length} รายการ)`);
    }

    const targetTt = officialTt ?? createOfficialRayongTimetable(dataset);
    const packed = encodePlacements(targetTt.placements);
    await db.doc(`schools/${schoolId}/terms/${termId}/timetables/${targetTt.id}`).set({
      ...packed,
      termId,
      label: targetTt.label,
      status: targetTt.status,
      entryCount: targetTt.placements.length,
      hardViolations: 0,
      softScore: 0,
      metrics: targetTt.metrics ?? { hard: 0, soft: 0, elapsedMs: 0 },
      source: targetTt.source,
      note: targetTt.note,
      createdAt: targetTt.createdAt,
      updatedAt: targetTt.updatedAt,
      publishedAt: targetTt.publishedAt,
    });
    console.log(`  ✓ บันทึกตารางสอนทางการ 33 ชม. (${targetTt.id})`);
  } else if (isFirebaseConfigured()) {
    console.log("  โหมดเชื่อมต่อ: Firebase Client SDK");
    const db: Firestore = getClientDb();
    const subCols = ["courses", "teachers", "rooms", "groups", "assignments", "activities", "timetables"] as const;

    // 1. ลบข้อมูลเดิม
    for (const colName of subCols) {
      const cRef = collection(db, `schools/${schoolId}/terms/${termId}/${colName}`);
      const snap = await getDocs(cRef).catch(() => null);
      if (snap && !snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        console.log(`  - ลบข้อมูลเดิมใน ${colName} เรียบร้อย`);
      }
    }
    const studentSnap = await getDocs(collection(db, `schools/${schoolId}/students`)).catch(() => null);
    if (studentSnap && !studentSnap.empty) {
      const batch = writeBatch(db);
      studentSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      console.log(`  - ลบข้อมูลเดิมใน students เรียบร้อย`);
    }

    // 2. บันทึกข้อมูล SchoolDoc
    const batch = writeBatch(db);
    batch.set(doc(db, `schools/${schoolId}`), {
      name: dataset.school.name,
      departmentCode: dataset.school.departmentCode ?? "901",
      departmentName: dataset.school.departmentName ?? "เทคโนโลยีสารสนเทศและการสื่อสาร",
      regularEndTime: dataset.school.regularEndTime,
      signatories: dataset.school.signatories,
      activeTermId: termId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    batch.set(doc(db, `schools/${schoolId}/terms/${termId}`), {
      year: dataset.term.year,
      term: dataset.term.term,
      status: dataset.term.status,
      publishedVersionId: officialTt ? officialTt.id : "tt-rayong-official",
      updatedAt: new Date().toISOString(),
    });

    batch.set(doc(db, `schools/${schoolId}/terms/${termId}/config/time`), dataset.time);
    batch.set(doc(db, `schools/${schoolId}/terms/${termId}/config/workloadRules`), { rules: dataset.workloadRules ?? [] });
    await batch.commit();
    console.log("  ✓ บันทึก school, term, time, workloadRules สำเร็จ");

    // 3. บันทึก Entity Collections
    for (const col of subCols) {
      if (col === "timetables") continue;
      const items = dataset[col];
      if (!items || items.length === 0) continue;
      const b = writeBatch(db);
      for (const item of items) {
        b.set(doc(db, `schools/${schoolId}/terms/${termId}/${col}/${item.id}`), stripId(item));
      }
      await b.commit();
      console.log(`  ✓ บันทึก ${col} (${items.length} รายการ)`);
    }

    if (dataset.students.length > 0) {
      const b = writeBatch(db);
      for (const s of dataset.students) {
        b.set(doc(db, `schools/${schoolId}/students/${s.id}`), stripId(s));
      }
      await b.commit();
      console.log(`  ✓ บันทึก students (${dataset.students.length} รายการ)`);
    }

    // 4. บันทึก Timetable
    const targetTt = officialTt ?? createOfficialRayongTimetable(dataset);
    const packed = encodePlacements(targetTt.placements);
    const tb = writeBatch(db);
    tb.set(doc(db, `schools/${schoolId}/terms/${termId}/timetables/${targetTt.id}`), {
      ...packed,
      termId,
      label: targetTt.label,
      status: targetTt.status,
      entryCount: targetTt.placements.length,
      hardViolations: 0,
      softScore: 0,
      metrics: targetTt.metrics ?? { hard: 0, soft: 0, elapsedMs: 0 },
      source: targetTt.source,
      note: targetTt.note,
      createdAt: targetTt.createdAt,
      updatedAt: targetTt.updatedAt,
      publishedAt: targetTt.publishedAt,
    });
    await tb.commit();
    console.log(`  ✓ บันทึกตารางสอนทางการ 33 ชม. (${targetTt.id})`);
  } else {
    console.log("  โหมดจำลอง: ไม่มี Firebase config (ทำงานแบบ Offline/Demo)");
  }

  console.log("\n==================================================================");
  console.log(" 🎉 [Wipe & Seed] เสร็จสิ้นสมบูรณ์! ข้อมูลวิทยาลัยเทคนิคระยองถูกบันทึกเรียบร้อย");
  console.log("==================================================================");
  return {
    ok: true,
    teachers: dataset.teachers.length,
    groups: dataset.groups.length,
    rooms: dataset.rooms.length,
    courses: dataset.courses.length,
    assignments: dataset.assignments.length,
    rules: dataset.workloadRules?.length ?? 0,
  };
}

if (process.argv[1] && process.argv[1].endsWith("seed-firestore.ts")) {
  wipeAndSeedFirestore()
    .then((r) => {
      console.log("ผลลัพธ์:", JSON.stringify(r));
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ ล้มเหลว:", err);
      process.exit(1);
    });
}
