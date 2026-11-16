import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Handjet, IBM_Plex_Mono } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";

// Văn bản đọc: Be Vietnam Pro (tròn, rõ dấu tiếng Việt). Tiêu đề, số lớn, nút: Handjet (phông pixel có đủ dấu tiếng Việt).
const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bvp",
  display: "swap",
});

const display = Handjet({
  subsets: ["latin", "vietnamese"],
  variable: "--font-handjet",
  display: "swap",
});

// Đồng hồ và mã số cần chữ số đều bề ngang để không giật khi nhảy số.
const mono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: brand.orgName ? `ExamQR – ${brand.orgName}` : "ExamQR – Kiểm tra trên lớp",
  description: "Kiểm tra trắc nghiệm trên lớp bằng mã QR",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f2560",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
