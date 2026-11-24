import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learning Table — ระบบจัดตารางการเรียนการสอน",
  description: "จัดตารางสอนอัตโนมัติ ตรวจข้อขัดแย้ง และส่งออก PDF/Excel",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
