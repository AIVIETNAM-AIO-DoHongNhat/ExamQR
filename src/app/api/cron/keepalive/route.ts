import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron gọi mỗi ngày (xem vercel.json) để project Supabase gói miễn phí
 * luôn có hoạt động và không bị tạm dừng.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const teachers = await prisma.teacher.count();
  return NextResponse.json({ ok: true, teachers, at: new Date().toISOString() });
}
