"use client";
import { useState } from "react";
import { Button, Card, Dialog, useToast } from "@/components/ui";
import { errorMessage } from "@/components/data/form-utils";
import { useData } from "@/lib/store/data-context";

export function ResetSection() {
  const { resetToMock, loadRayongData, clearAllData, mode } = useData();
  const toast = useToast();
  const [openMock, setOpenMock] = useState(false);
  const [openClear, setOpenClear] = useState(false);
  const [openSeed, setOpenSeed] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirmSeed = async () => {
    setBusy(true);
    try {
      await loadRayongData();
      toast("ลบข้อมูลเดิมและบันทึกชุดข้อมูล วท.ระยอง ตามไฟล์แนบสำเร็จแล้ว", "ok");
      setOpenSeed(false);
    } catch (e) {
      toast(`บันทึกข้อมูลไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setBusy(false);
    }
  };

  const confirmMock = async () => {
    setBusy(true);
    try {
      await resetToMock();
      toast("รีเซ็ตเป็นข้อมูลจำลองแล้ว", "ok");
      setOpenMock(false);
    } catch (e) {
      toast(`รีเซ็ตไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setBusy(false);
    }
  };

  const confirmClear = async () => {
    setBusy(true);
    try {
      await clearAllData();
      toast("ล้างข้อมูลเรียบร้อยแล้ว พร้อมสำหรับกรอกข้อมูลจริง", "ok");
      setOpenClear(false);
    } catch (e) {
      toast(`ล้างข้อมูลไม่สำเร็จ: ${errorMessage(e)}`, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="จัดการชุดข้อมูล">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line bg-accent/5 p-3 rounded-lg border-accent/20">
          <div>
            <span className="block font-semibold text-accent">นำเข้าข้อมูลจริง วิทยาลัยเทคนิคระยอง (Wipe & Seed)</span>
            <span className="block text-xs text-muted">ล้าง collection เดิมทั้งหมด และนำเข้าข้อมูล แผนกวิชาเทคโนโลยีสารสนเทศและการสื่อสาร (10 ครู, 12 กลุ่มเรียน, 8 ห้อง, เกณฑ์ชั่วโมงสอน, และตารางสอนทางการ 33 ชม. อ.ปริญญา จำเนียรพล)</span>
          </div>
          <Button variant="primary" onClick={() => setOpenSeed(true)}>
            ล้างและนำเข้าข้อมูลชุดนี้
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
          <div>
            <span className="block font-medium text-ink">ล้างข้อมูลเพื่อเริ่มกรอกข้อมูลจริง</span>
            <span className="block text-xs text-muted">ล้างรายวิชา ครู ห้อง กลุ่มเรียน และตารางสอนทั้งหมด เพื่อเตรียมป้อนข้อมูลจริงของสถานศึกษา</span>
          </div>
          <Button variant="secondary" onClick={() => setOpenClear(true)}>
            ล้างข้อมูลเพื่อใส่ข้อมูลจริง
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="block font-medium text-ink">รีเซ็ตกลับเป็นข้อมูลจำลอง (Demo Data)</span>
            <span className="block text-xs text-muted">แทนที่ข้อมูลทั้งหมดด้วยชุดข้อมูลตัวอย่างสำหรับสาธิตและทดสอบระบบ</span>
          </div>
          <Button variant="danger" onClick={() => setOpenMock(true)}>
            รีเซ็ตเป็นข้อมูลจำลอง
          </Button>
        </div>
      </div>


      <Dialog
        open={openSeed}
        onClose={() => setOpenSeed(false)}
        title="ยืนยันการล้าง collection เดิมและนำเข้าข้อมูลชุด วท.ระยอง"
        footer={
          <>
            <Button onClick={() => setOpenSeed(false)}>ยกเลิก</Button>
            <Button variant="primary" loading={busy} onClick={confirmSeed}>
              ยืนยันล้างและนำเข้า
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>
            ระบบจะลบข้อมูลใน collection เดิมออกทั้งหมด แล้วนำเข้าข้อมูลแผนกวิชาเทคโนโลยีสารสนเทศและการสื่อสาร วิทยาลัยเทคนิคระยอง
            ตามไฟล์แนบจริง:
          </p>
          <ul className="list-disc pl-5 text-xs text-muted flex flex-col gap-1">
            <li>ข้อมูลสถานศึกษาและ 4 ผู้ลงนาม (ผอ., รองฯ, หน.พัฒนาหลักสูตร, หน.แผนก)</li>
            <li>เกณฑ์ภาระชั่วโมงสอน: ครูปกติ ปวช. 18 / ปวส. 15, หน.งาน/หน.แผนก ปวช. 12 / ปวส. 10</li>
            <li>ครูผู้สอน 10 ท่าน และกลุ่มเรียน 12 กลุ่ม (ปวช.1–3, ปวส.1–2)</li>
            <li>ห้องเรียน 8 ห้อง และรายวิชาหลักสูตรครบถ้วน</li>
            <li>ตารางสอนทางการ 33 ชั่วโมงของ อ.ปริญญา จำเนียรพล (รวมกิจกรรมและ PLC)</li>
          </ul>
        </div>
      </Dialog>

      <Dialog
        open={openClear}
        onClose={() => setOpenClear(false)}
        title="ยืนยันการล้างข้อมูลเพื่อใส่ข้อมูลจริง"
        footer={
          <>
            <Button onClick={() => setOpenClear(false)}>ยกเลิก</Button>
            <Button variant="primary" loading={busy} onClick={confirmClear}>
              ยืนยันล้างข้อมูล
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-sm">
          <p>ระบบจะล้างรายชื่อครู รายวิชา ห้องเรียน กลุ่มเรียน และตารางสอนทั้งหมด โดยคงโครงสร้างเวลาและข้อมูลสถานศึกษาไว้ เพื่อให้คุณสามารถเริ่มนำเข้าไฟล์ Excel หรือป้อนข้อมูลจริงได้ทันที</p>
        </div>
      </Dialog>


      <Dialog
        open={openMock}
        onClose={() => setOpenMock(false)}
        title="ยืนยันการรีเซ็ตข้อมูลจำลอง"
        footer={
          <>
            <Button onClick={() => setOpenMock(false)}>ยกเลิก</Button>
            <Button variant="danger" loading={busy} onClick={confirmMock}>
              ยืนยันรีเซ็ต
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-sm">
          <p>ข้อมูลหลัก การตั้งค่า และตารางสอนทั้งหมดจะถูกแทนที่ด้วยข้อมูลจำลอง และไม่สามารถย้อนกลับได้</p>
        </div>
      </Dialog>
    </Card>
  );
}
