import { NextRequest, NextResponse } from "next/server";

export interface AIAdvisorRequest {
  algorithm: string;
  seed: number;
  hard: number;
  soft: number;
  elapsedMs: number;
  placementsCount: number;
  breakdown: Record<string, number>;
  explanations: string[];
}

export interface AIAdvisorResponse {
  source: "openrouter" | "rule-based";
  executiveSummary: string;
  strengths: string[];
  recommendations: string[];
  riskAssessment: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AIAdvisorRequest;
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

    // 1. ถ้ามี API Key ให้เรียก OpenRouter API
    if (apiKey && apiKey.trim() !== "") {
      try {
        const prompt = `
คุณคือผู้เชี่ยวชาญระดับสูงด้านการวางแผนตารางเรียนตารางสอน และการบริหารวิชาการในสังกัดสำนักงานคณะกรรมการการอาชีวศึกษา (สอศ.)
วิเคราะห์ผลลัพธ์การจัดตารางสอนต่อไปนี้อย่างกระชับและเป็นมืออาชีพ:

- อัลกอริทึมที่ใช้: ${body.algorithm} (Seed: ${body.seed})
- ข้อขัดแย้ง Hard Constraints: ${body.hard} (${body.hard === 0 ? "ผ่านสมบูรณ์ 100% ไม่มีการชน" : "มีข้อขัดแย้ง " + body.hard + " จุด"})
- คะแนนความพึงพอใจ Soft Score: ${body.soft} (ยิ่งต่ำยิ่งดี)
- เวลาที่ใช้คำนวณ: ${(body.elapsedMs / 1000).toFixed(2)} วินาที
- จำนวนบล็อกคาบที่จัดได้: ${body.placementsCount} คาบ
- สถิติค่าน้ำหนักย่อย (Breakdown):
  • คาบว่างคั่นของครู: ${body.breakdown?.teacherGaps ?? 0}
  • คาบว่างคั่นของผู้เรียน: ${body.breakdown?.studentGaps ?? 0}
  • ความสมดุลภาระรายวัน: ${body.breakdown?.dayBalance ?? 0}
  • การย้ายห้องเรียน: ${body.breakdown?.roomChanges ?? 0}
  • คาบนอกเวลาราชการ: ${body.breakdown?.lateHours ?? 0}
- สรุปจากระบบ:
${body.explanations?.join("\n") ?? "ไม่มี"}

ให้ตอบกลับในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "executiveSummary": "บทสรุปภาพรวมเชิงบริหารสำหรับหัวหน้าแผนก/ฝ่ายวิชาการ (ความยาว 2-3 ประโยค)",
  "strengths": ["จุดเด่นข้อที่ 1", "จุดเด่นข้อที่ 2", "จุดเด่นข้อที่ 3"],
  "recommendations": ["ข้อเสนอแนะเชิงกลยุทธ์ 1", "ข้อเสนอแนะเชิงกลยุทธ์ 2"],
  "riskAssessment": "การประเมินความเสี่ยงและจุดที่ต้องเฝ้าระวังในการปฏิบัติงานจริง"
}
`;

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.choices?.[0]?.message?.content;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            return NextResponse.json<AIAdvisorResponse>({
              source: "openrouter",
              executiveSummary: parsed.executiveSummary || "ตารางสอนผ่านเกณฑ์มาตรฐานการจัดเวลาเรียน",
              strengths: parsed.strengths || ["ไม่มีการละเมิดเงื่อนไขบังคับ", "จัดคาบต่อเนื่องได้ครบถ้วน"],
              recommendations: parsed.recommendations || ["สามารถนำไปใช้เป็นตารางสอนทางการได้"],
              riskAssessment: parsed.riskAssessment || "ความเสี่ยงต่ำ สามารถบริหารจัดการห้องเรียนได้ตามปกติ",
            });
          }
        }
      } catch (geminiErr) {
        console.warn("OpenRouter API call failed, falling back to rule-based analysis:", geminiErr);
      }
    }

    // 2. Fallback: การวิเคราะห์เชิงวิชาการแบบ Rule-based ในตัว (Zero Risk)
    const isHardOk = body.hard === 0;
    const strengths: string[] = [];
    const recommendations: string[] = [];

    if (isHardOk) {
      strengths.push("ตารางผ่านเกณฑ์เงื่อนไขบังคับ (Hard Constraints) สมบูรณ์ 100% ไม่มีการชนเวลา ครู หรือห้องเรียน");
      if ((body.breakdown?.teacherGaps ?? 0) <= 5) {
        strengths.push("เกลี่ยคาบว่างของครูได้ดีมาก มีคาบว่างคั่นน้อย ช่วยประหยัดเวลาปฏิบัติงาน");
      } else {
        recommendations.push("สามารถเพิ่มน้ำหนัก 'คาบว่างคั่นของครู' ในการจัดครั้งถัดไปเพื่อลดระยะเวลารอระหว่างคาบ");
      }
      if ((body.breakdown?.roomChanges ?? 0) <= 4) {
        strengths.push("กลุ่มเรียนมีการย้ายห้องน้อย ลดความสับสนและการเดินทางระหว่างอาคารเรียน");
      }
    } else {
      recommendations.push(`พบข้อขัดแย้ง Hard ${body.hard} จุด ควรปรับแก้คาบที่ชนกันก่อนเผยแพร่จริง`);
    }

    strengths.push(`คำนวณรวดเร็วด้วยอัลกอริทึม ${body.algorithm} ใช้เวลาเพียง ${(body.elapsedMs / 1000).toFixed(2)} วินาที`);
    if (recommendations.length === 0) {
      recommendations.push("ตารางมีคุณภาพเหมาะสม สามารถเสนอรองผู้อำนวยการฝ่ายวิชาการเพื่อลงนามอนุมัติได้");
    }

    const fallbackResponse: AIAdvisorResponse = {
      source: "rule-based",
      executiveSummary: isHardOk
        ? `ตารางสอนที่จัดด้วย ${body.algorithm} ผ่านเกณฑ์มาตรฐานวิชาการ สอศ. โดยมีค่าความพึงพอใจ Soft Score อยู่ที่ ${body.soft.toFixed(1)} และจัดวางครบถ้วน ${body.placementsCount} คาบ`
        : `ตารางนี้ยังมีข้อขัดแย้ง Hard Constraints จำนวน ${body.hard} รายการ แนะนำให้ใช้เครื่องมือปรับแต่งรายคาบเพื่อแก้ไข`,
      strengths,
      recommendations,
      riskAssessment: isHardOk
        ? "ความเสี่ยงต่ำ: ตารางไม่มีข้อขัดแย้งด้านเวลาและสถานที่ มีความพร้อมสำหรับเปิดภาคเรียน"
        : "ความเสี่ยงสูง: ไม่ควรเผยแพร่ตารางจนกว่าจะแก้ไขข้อขัดแย้ง Hard ให้หมดสิ้น",
    };

    return NextResponse.json<AIAdvisorResponse>(fallbackResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

