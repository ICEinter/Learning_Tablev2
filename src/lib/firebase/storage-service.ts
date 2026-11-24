/**
 * Firebase Storage Service & Metadata Collection
 * จัดการอัปโหลดไฟล์ (PDF, Excel, CSV) ขึ้น Firebase Storage
 * และบันทึก Metadata ลงคอลเลกชัน "storage_files" ใน Firestore
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import { getClientStorage, getClientDb } from "./client";
import { isFirebaseConfigured, getSchoolId } from "./config";

export interface StoredFileRecord {
  id: string;
  schoolId: string;
  name: string;
  path: string;
  url: string;
  contentType: string;
  size: number;
  category: "timetable_pdf" | "timetable_excel" | "report_pdf" | "report_excel" | "raw_import" | "backup";
  termId?: string;
  timetableId?: string;
  createdAt: string;
  uploadedBy?: string;
}

/**
 * อัปโหลดไฟล์ขึ้น Firebase Storage พร้อมบันทึกลง collection "storage_files"
 */
export async function uploadToFirebaseStorage(params: {
  file: Blob | Uint8Array<ArrayBuffer> | ArrayBuffer;
  filename: string;
  category: StoredFileRecord["category"];
  termId?: string;
  timetableId?: string;
  contentType?: string;
  uploadedBy?: string;
}): Promise<StoredFileRecord> {
  const schoolId = getSchoolId();
  const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const cleanName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `schools/${schoolId}/${params.category}/${fileId}_${cleanName}`;
  const now = new Date().toISOString();

  // กรณี Offline หรือไม่มี Firebase Config ให้จำลองเป็น Local Object URL
  if (!isFirebaseConfigured()) {
    const blob = params.file instanceof Blob ? params.file : new Blob([params.file as any]);
    const mockUrl = typeof window !== "undefined" ? URL.createObjectURL(blob) : `mock://${cleanName}`;
    const mockRecord: StoredFileRecord = {
      id: fileId,
      schoolId,
      name: params.filename,
      path: storagePath,
      url: mockUrl,
      contentType: params.contentType || "application/octet-stream",
      size: blob.size,
      category: params.category,
      termId: params.termId,
      timetableId: params.timetableId,
      createdAt: now,
      uploadedBy: params.uploadedBy || "local-user",
    };
    saveLocalFileMetadata(mockRecord);
    return mockRecord;
  }

  // อัปโหลดเข้า Firebase Storage จริง
  const storage = getClientStorage();
  const storageRef = ref(storage, storagePath);
  const blob = params.file instanceof Blob ? params.file : new Blob([params.file as any]);
  
  await uploadBytes(storageRef, blob, {
    contentType: params.contentType || "application/octet-stream",
  });
  const downloadUrl = await getDownloadURL(storageRef);

  const fileRecord: StoredFileRecord = {
    id: fileId,
    schoolId,
    name: params.filename,
    path: storagePath,
    url: downloadUrl,
    contentType: params.contentType || blob.type || "application/octet-stream",
    size: blob.size,
    category: params.category,
    termId: params.termId,
    timetableId: params.timetableId,
    createdAt: now,
    uploadedBy: params.uploadedBy || "user",
  };

  // บันทึกลง Firestore Collection "storage_files"
  try {
    const db = getClientDb();
    const docRef = doc(db, "storage_files", fileId);
    await setDoc(docRef, fileRecord);
  } catch (err) {
    console.warn("Could not save to Firestore storage_files collection:", err);
  }

  return fileRecord;
}

/** ดึงรายการประวัติไฟล์จาก Collection "storage_files" */
export async function listStoredFiles(category?: StoredFileRecord["category"]): Promise<StoredFileRecord[]> {
  const schoolId = getSchoolId();
  if (!isFirebaseConfigured()) {
    return getLocalFilesMetadata(category);
  }

  try {
    const db = getClientDb();
    const colRef = collection(db, "storage_files");
    const q = query(colRef, where("schoolId", "==", schoolId));
    const snapshot = await getDocs(q);
    const files: StoredFileRecord[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as StoredFileRecord;
      if (!category || data.category === category) {
        files.push(data);
      }
    });
    return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    console.warn("Error fetching storage_files from Firestore:", err);
    return getLocalFilesMetadata(category);
  }
}

const LOCAL_STORAGE_KEY = "learning-table:storage-files";

function saveLocalFileMetadata(rec: StoredFileRecord) {
  try {
    const list = getLocalFilesMetadata();
    list.unshift(rec);
    globalThis.localStorage?.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

function getLocalFilesMetadata(category?: string): StoredFileRecord[] {
  try {
    const raw = globalThis.localStorage?.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as StoredFileRecord[];
    if (category) return list.filter((x) => x.category === category);
    return list;
  } catch {
    return [];
  }
}