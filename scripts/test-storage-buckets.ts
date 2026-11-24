import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const configs = [
  "learning-time-2dba3.appspot.com",
  "learning-time-2dba3.firebasestorage.app"
];

async function check() {
  for (const b of configs) {
    console.log(`\n--- ทดสอบ Bucket: ${b} ---`);
    try {
      const app = initializeApp({
        apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
        authDomain: "learning-time-2dba3.firebaseapp.com",
        projectId: "learning-time-2dba3",
        storageBucket: b,
        appId: "1:547379531341:web:e8a0229c8bdf4f03ad5604"
      }, "test-" + b);

      const storage = getStorage(app);
      const testRef = ref(storage, "ping.txt");
      const testData = new TextEncoder().encode("Hello from Learning Table V2");
      await uploadBytes(testRef, testData, { contentType: "text/plain" });
      const url = await getDownloadURL(testRef);
      console.log(`✅ Bucket ${b} อัปโหลดสำเร็จ! URL:`, url);
    } catch (err: any) {
      console.log(`❌ Bucket ${b} ไม่สำเร็จ (${err.code}):`, err.message);
    }
  }

  // ทดสอบ Firestore collection storage_files
  console.log("\n--- ทดสอบ Firestore Collection storage_files ---");
  try {
    const app = initializeApp({
      apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
      authDomain: "learning-time-2dba3.firebaseapp.com",
      projectId: "learning-time-2dba3",
      appId: "1:547379531341:web:e8a0229c8bdf4f03ad5604"
    }, "firestore-test");
    const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    const docRef = doc(db, "storage_files", "ping_check");
    await setDoc(docRef, { ping: true, time: new Date().toISOString() });
    const snap = await getDoc(docRef);
    console.log("✅ Firestore Collection storage_files เขียน/อ่านสำเร็จ! ข้อมูล:", snap.data());
  } catch (err: any) {
    console.log("❌ Firestore storage_files:", err.message);
  }
}

check();