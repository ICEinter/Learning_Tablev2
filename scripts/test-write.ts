import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc } from "firebase/firestore";

const cfg = {
  apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
  authDomain: "learning-time-2dba3.firebaseapp.com",
  projectId: "learning-time-2dba3"
};

async function test() {
  const app = initializeApp(cfg);
  const db = initializeFirestore(app, {});
  try {
    await setDoc(doc(db, "schools", "school-main"), {
      name: "วิทยาลัยเทคนิคระยอง",
      createdAt: new Date().toISOString()
    });
    console.log("SUCCESS_WRITE");
  } catch (err: any) {
    console.log("FAIL_WRITE:", err.message);
  }
}
test();