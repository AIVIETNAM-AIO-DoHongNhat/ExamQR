import type { Metadata } from "next";
import { DemoBoard } from "./DemoBoard";

export const metadata: Metadata = { title: "Thử màn chiếu – ExamQR" };

/** Mô phỏng một lớp đang làm bài, để thử máy chiếu/laptop trước buổi học. Không dùng CSDL. */
export default async function DemoPage({ searchParams }: { searchParams: Promise<{ n?: string; q?: string; view?: string }> }) {
  const sp = await searchParams;
  const n = Math.min(100, Math.max(1, Number(sp.n) || 40));
  const q = Math.min(60, Math.max(1, Number(sp.q) || 20));
  const view = sp.view === "3d" || sp.view === "summary" || sp.view === "lobby" ? sp.view : "2d";
  return <DemoBoard students={n} questions={q} view={view} />;
}
