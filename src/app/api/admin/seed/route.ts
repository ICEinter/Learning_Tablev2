import { NextResponse } from "next/server";
import { isAdminConfigured } from "@/lib/firebase/admin";
import { HttpError, json, jsonError, requireUser } from "@/lib/auth/server";
import { wipeAndSeedFirestore } from "../../../../../scripts/seed-firestore";

export const runtime = "nodejs";

/**
 * POST /api/admin/seed
 * ล้างข้อมูลใน Collection เดิมออกทั้งหมด แล้วบรรจุชุดข้อมูลวิทยาลัยเทคนิคระยองตามไฟล์แนบลง Firestore
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // ต้องเป็นสิทธิ์ Admin
    await requireUser(req, ["admin"]);

    if (!isAdminConfigured()) {
      return json({
        ok: true,
        mode: "demo",
        message: "ระบบกำลังทำงานในโหมด Demo / ออฟไลน์ ข้อมูลถูกจัดเตรียมในหน่วยความจำเรียบร้อยแล้ว",
      });
    }

    const result = await wipeAndSeedFirestore();
    return json({
      ok: true,
      message: "ล้างข้อมูลใน Collection เดิมออกทั้งหมด และบันทึกข้อมูลวิทยาลัยเทคนิคระยองสำเร็จ",
      result,
    });
  } catch (e) {
    return jsonError(e);
  }
}
