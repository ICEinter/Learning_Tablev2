import type { DocumentReference, Firestore } from "firebase-admin/firestore";

export const BATCH_LIMIT = 450;

type Op = { kind: "set"; ref: DocumentReference; data: object } | { kind: "delete"; ref: DocumentReference };

/** เขียนแบบแบ่ง batch ละไม่เกิน 450 ops */
export async function commitInChunks(db: Firestore, ops: Op[]): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_LIMIT)) {
      if (op.kind === "set") batch.set(op.ref, op.data);
      else batch.delete(op.ref);
    }
    await batch.commit();
  }
}

/** ลบเอกสารทั้งหมดใน collection (ใช้กับ views ของเวอร์ชัน) */
export async function deleteCollection(db: Firestore, path: string): Promise<number> {
  const refs = await db.collection(path).listDocuments();
  await commitInChunks(db, refs.map((ref) => ({ kind: "delete" as const, ref })));
  return refs.length;
}
