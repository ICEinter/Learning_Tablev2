import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
  authDomain: "learning-time-2dba3.firebaseapp.com",
  projectId: "learning-time-2dba3",
  storageBucket: "learning-time-2dba3.firebasestorage.app",
  messagingSenderId: "547379531341",
  appId: "1:547379531341:web:e8a0229c8bdf4f03ad5604"
};

async function check() {
  console.log("=== เริ่มตรวจสอบการเชื่อมต่อ Firebase ===");
  try {
    const app = initializeApp(firebaseConfig, "test-checker");
    console.log("1. Initialize Firebase App: สำเร็จ ✅");

    // 1. ทดสอบ Storage
    const storage = getStorage(app);
    console.log("2. Target Storage Bucket:", storage.app.options.storageBucket);
    const testRef = ref(storage, "test_connection/ping.txt");
    const testData = new TextEncoder().encode("Firebase Storage connection test from Learning Table V2 - " + new Date().toISOString());
    
    console.log("3. กำลังทดสอบอัปโหลดไฟล์ไปยัง Firebase Storage...");
    const uploadRes = await uploadBytes(testRef, testData, { contentType: "text/plain" });
    console.log("4. Upload Bytes: สำเร็จ! Path =", uploadRes.metadata.fullPath, "✅");
    const downloadUrl = await getDownloadURL(testRef);
    console.log("5. ได้รับ Download URL จาก Storage:", downloadUrl, "✅");

    // 2. ทดสอบ Firestore collection storage_files
    const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    console.log("6. กำลังทดสอบบันทึกข้อมูลลง Firestore collection 'storage_files'...");
    const docRef = doc(db, "storage_files", "test_ping_doc");
    await setDoc(docRef, {
      test: true,
      service: "Firebase Storage",
      bucket: storage.app.options.storageBucket,
      downloadUrl: downloadUrl,
      updatedAt: new Date().toISOString()
    });
    console.log("7. บันทึกลง Firestore collection 'storage_files': สำเร็จ! ✅");

    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log("8. อ่านข้อมูลกลับจาก collection 'storage_files': สำเร็จ! ✅ ข้อมูล:", snap.data());
    }

    console.log("\n>>> สรุป: ทั้ง Firebase Storage และ Firestore collection 'storage_files' เชื่อมต่อได้สมบูรณ์ 100%! <<<");
  } catch (err) {
    console.error("เกิดข้อผิดพลาดในการเชื่อมต่อ:", err);
  }
}

check();