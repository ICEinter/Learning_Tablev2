/**
 * การตัดบรรทัดภาษาไทยสำหรับ PDF
 *
 * pdfmake ตัดบรรทัดตาม UAX#14 ซึ่งไม่ตัดคำภาษาไทย (ทั้งประโยคไทยเป็น "คำ" เดียว)
 * วิธีมาตรฐานคือแทรก U+200B ระหว่างคำ แต่ฟอนต์ Sarabun ไม่มี glyph ของ U+200B
 * (ตรวจแล้ว: ได้ .notdef กว้าง 0.7em เป็นกล่องสี่เหลี่ยม) จึงใช้วิธีตัดคำเอง:
 *   1) แบ่งคำด้วย Intl.Segmenter('th', { granularity: 'word' })
 *   2) วัดความกว้างด้วยตาราง advance width ของ Sarabun (ดึงจากไฟล์ TTF จริง หน่วย 1/1000 em)
 *   3) จัดคำลงบรรทัดแบบ greedy แล้วแทรก "\n" เอง
 * ภาษาไทยใน Sarabun ไม่มี kerning ระหว่างตัวอักษร ความกว้างจึงตรงกับที่ PDFKit วาดจริง
 */

// advance widths: [0x20..0x7E], [0x0E01..0x0E5B]  (-1 = ไม่มี glyph)
const REG_ASCII = [243,237,354,686,529,903,668,192,318,318,448,607,252,340,252,415,550,550,550,550,550,550,550,550,550,550,252,252,607,607,607,454,795,596,589,585,623,552,550,636,678,292,440,605,548,798,682,661,573,661,581,529,558,657,602,831,605,573,567,308,382,308,585,323,400,514,542,473,542,518,331,541,558,245,247,487,291,839,549,557,545,545,350,416,377,552,479,668,460,462,451,320,242,320,607];
const REG_THAI = [576,594,606,603,607,638,454,556,570,606,616,807,830,612,612,539,708,831,831,592,607,581,657,542,637,645,655,622,622,720,720,616,614,572,484,581,580,612,512,602,677,580,636,720,587,565,546,534,0,485,485,0,0,0,0,0,0,0,-1,-1,-1,-1,589,310,579,379,378,390,293,621,0,0,0,0,0,0,0,0,621,660,676,685,694,678,678,675,744,674,692,767,1020];
const BOLD_ASCII = [233,256,405,707,541,968,697,205,354,354,448,617,291,340,291,468,565,565,565,565,565,565,565,565,565,565,291,291,617,617,617,471,805,641,606,620,642,571,574,653,692,323,492,656,565,816,699,690,590,690,596,551,590,662,647,874,655,628,592,332,385,332,599,358,400,529,558,492,558,542,377,555,567,273,279,533,301,846,563,579,565,565,397,441,420,561,528,707,520,505,476,350,257,350,617];
const BOLD_THAI = [597,632,656,624,628,679,482,571,594,650,667,832,849,622,622,573,761,876,884,614,628,598,678,584,650,651,669,649,649,739,739,630,630,587,498,598,600,622,535,624,718,600,645,739,601,584,574,548,0,510,510,0,0,0,0,0,0,0,-1,-1,-1,-1,603,326,616,409,425,449,304,666,0,0,0,0,0,0,0,0,626,666,691,716,709,688,688,673,793,684,700,831,1055];

const FALLBACK = 600;
/** อักขระอื่นที่ใช้บ่อย (Sarabun Regular; Bold ต่างกันเล็กน้อย) */
const EXTRA: Record<number, number> = {
  0xb7: 251, 0x2013: 540, 0x2014: 836, 0x2015: 836, 0x2026: 723, 0x2022: 368,
  0x201c: 534, 0x201d: 534, 0x2018: 338, 0x2019: 338, 0xab: 515, 0xbb: 515, 0x2265: 607,
};

function charWidth(cp: number, bold: boolean): number {
  if (cp >= 0x20 && cp <= 0x7e) return (bold ? BOLD_ASCII : REG_ASCII)[cp - 0x20];
  if (cp >= 0x0e01 && cp <= 0x0e5b) {
    const w = (bold ? BOLD_THAI : REG_THAI)[cp - 0x0e01];
    return w < 0 ? FALLBACK : w;
  }
  return EXTRA[cp] ?? FALLBACK;
}

/** ความกว้างของข้อความเป็น pt */
export function textWidth(text: string, fontSize: number, bold = false): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch.codePointAt(0)!, bold);
  return (w / 1000) * fontSize;
}

const THAI_RE = /[฀-๿]/;

type SegmenterLike = { segment(s: string): Iterable<{ segment: string }> };

let wordSeg: SegmenterLike | null | undefined;
let graphemeSeg: SegmenterLike | null | undefined;

function getSegmenter(granularity: "word" | "grapheme"): SegmenterLike | null {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => SegmenterLike }).Segmenter;
  if (!Seg) return null;
  if (granularity === "word") return (wordSeg ??= new Seg("th", { granularity: "word" }));
  return (graphemeSeg ??= new Seg("th", { granularity: "grapheme" }));
}

/** แบ่งข้อความเป็นหน่วยที่ตัดบรรทัดได้ (คำไทย / คำอังกฤษ / ช่องว่าง) */
export function segmentWords(text: string): string[] {
  const seg = THAI_RE.test(text) ? getSegmenter("word") : null;
  if (!seg) return text.split(/(\s+)/).filter((s) => s !== "");
  const out: string[] = [];
  for (const s of seg.segment(text)) out.push(s.segment);
  // ไม่แยกเครื่องหมายวรรคตอนปิด/วงเล็บปิดออกไปขึ้นบรรทัดใหม่
  const merged: string[] = [];
  for (const w of out) {
    if (merged.length && /^[)\].,:;!?%»”’]+$/.test(w)) merged[merged.length - 1] += w;
    else if (merged.length && /[(\[«“‘]$/.test(merged[merged.length - 1])) merged[merged.length - 1] += w;
    else merged.push(w);
  }
  return merged;
}

function graphemes(text: string): string[] {
  const seg = getSegmenter("grapheme");
  if (!seg) return Array.from(text);
  return Array.from(seg.segment(text), (s) => s.segment);
}

/**
 * ตัดบรรทัดให้พอดีความกว้าง (pt) — คืนข้อความที่มี "\n"
 * คำที่ยาวเกินบรรทัดจะถูกตัดตาม grapheme (ไม่แยกสระ/วรรณยุกต์ออกจากพยัญชนะ)
 */
export function wrapText(text: string, maxWidth: number, fontSize: number, bold = false): string {
  if (!text) return "";
  const limit = Math.max(maxWidth * 0.97, fontSize);
  const outLines: string[] = [];
  for (const para of String(text).split(/\r?\n/)) {
    let line = "";
    let lineW = 0;
    const flush = () => {
      outLines.push(line.trimEnd());
      line = "";
      lineW = 0;
    };
    for (const word of segmentWords(para)) {
      const w = textWidth(word, fontSize, bold);
      if (lineW + w <= limit) {
        line += word;
        lineW += w;
        continue;
      }
      if (/^\s+$/.test(word)) {
        flush();
        continue;
      }
      if (line) flush();
      if (w <= limit) {
        line = word;
        lineW = w;
        continue;
      }
      for (const g of graphemes(word)) {
        const gw = textWidth(g, fontSize, bold);
        if (lineW + gw > limit && line) flush();
        line += g;
        lineW += gw;
      }
    }
    outLines.push(line.trimEnd());
  }
  return outLines.join("\n");
}

/** จำนวนบรรทัดหลังตัดคำ */
export function lineCount(text: string, maxWidth: number, fontSize: number, bold = false): number {
  return wrapText(text, maxWidth, fontSize, bold).split("\n").length;
}
