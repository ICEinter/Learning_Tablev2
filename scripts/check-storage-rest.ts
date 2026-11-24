import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const cfg = {
  apiKey: "AIzaSyCOA11qFjPodz-3csahwDOHWZq5tiTpaCA",
  authDomain: "learning-time-2dba3.firebaseapp.com",
  projectId: "learning-time-2dba3",
  storageBucket: "learning-time-2dba3.firebasestorage.app",
  appId: "1:547379531341:web:e8a0229c8bdf4f03ad5604"
};

async function testAuth() {
  const app = initializeApp(cfg, "auth-test");
  const auth = getAuth(app);
  console.log("CurrentUser:", auth.currentUser);

  // ทดสอบ REST endpoint ว่า Firebase Storage bucket เปิดใช้งานหรือยัง
  try {
    const res = await fetch("https://firebasestorage.googleapis.com/v0/b/learning-time-2dba3.firebasestorage.app/o");
    const json = await res.json();
    console.log("Firebase Storage REST API Check:", json);
  } catch (err: any) {
    console.log("REST Check Error:", err.message);
  }
}

testAuth();