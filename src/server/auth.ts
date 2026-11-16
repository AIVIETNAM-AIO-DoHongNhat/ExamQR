import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { missingEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { supabaseServer } from "@/lib/supabase-server";

/** Giảng viên đang đăng nhập (tạo bản ghi Teacher ở lần đầu), hoặc null. */
export const getTeacher = cache(async () => {
  // Chưa cấu hình: coi như chưa đăng nhập; trang /login sẽ hiện hướng dẫn cấu hình.
  if (missingEnv().length) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  return prisma.teacher.upsert({
    where: { id: user.id },
    update: {},
    create: {
      id: user.id,
      email: user.email,
      name: (user.user_metadata?.name as string | undefined) ?? null,
    },
  });
});

export async function requireTeacher() {
  const t = await getTeacher();
  if (!t) redirect("/login");
  return t;
}
