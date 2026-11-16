import type { Metadata } from "next";
import { DemoPlay, type DemoView } from "./DemoPlay";

export const metadata: Metadata = { title: "Xem thử giao diện học viên – ExamQR" };

const VIEWS: DemoView[] = ["join", "lobby", "exam", "review", "result"];

/** Xem thử các màn hình trên điện thoại học viên với dữ liệu giả, không cần CSDL. */
export default async function DemoPlayPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const v = VIEWS.includes(view as DemoView) ? (view as DemoView) : "exam";
  return <DemoPlay key={v} view={v} />;
}
