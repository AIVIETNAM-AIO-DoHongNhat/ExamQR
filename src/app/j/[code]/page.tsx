import type { Metadata } from "next";
import { missingEnv } from "@/lib/env";
import { SetupNotice } from "@/components/SetupNotice";
import { getPlayState } from "@/server/play-actions";
import { PlayApp } from "@/components/play/PlayApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Làm bài – ExamQR" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;
  const { code } = await params;
  const initial = await getPlayState(code);
  return <PlayApp code={code.toUpperCase()} initial={initial} />;
}
