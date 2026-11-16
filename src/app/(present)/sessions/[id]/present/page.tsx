import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { missingEnv } from "@/lib/env";
import { SetupNotice } from "@/components/SetupNotice";
import { requireTeacher } from "@/server/auth";
import { getBoardState } from "@/server/session-actions";
import { Board } from "@/components/board/Board";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Màn chiếu – ExamQR" };

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;
  const { id } = await params;
  await requireTeacher();
  const state = await getBoardState(id).catch(() => null);
  if (!state) notFound();
  return <Board initial={state} />;
}
