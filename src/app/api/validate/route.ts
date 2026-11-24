import { z } from "zod";
import { json, jsonError, readJson, requireUser } from "@/lib/auth/server";
import { DatasetSchema, PlacementSchema } from "@/shared/schemas";
import type { Dataset } from "@/shared/types";
import { isDemoServer, runValidate } from "../_lib/common";

export const runtime = "nodejs";

const BodySchema = z.object({
  dataset: DatasetSchema,
  placements: z.array(PlacementSchema).max(20000, "จำนวนคาบในตารางมากเกินกำหนด"),
});

/**
 * ตรวจตารางด้วย validator อิสระ (คำนวณล้วน ไม่เขียนฐานข้อมูล)
 * - โหมด Firebase: ต้องเป็น admin
 * - โหมดสาธิต (ไม่มี Firebase ทั้ง client และ admin): อนุญาตโดยไม่ต้อง login
 */
export async function POST(req: Request): Promise<Response> {
  try {
    if (!isDemoServer()) await requireUser(req, ["admin"]);
    const body = BodySchema.parse(await readJson(req));
    const result = await runValidate(body.dataset as Dataset, body.placements);
    return json(result);
  } catch (e) {
    return jsonError(e);
  }
}
