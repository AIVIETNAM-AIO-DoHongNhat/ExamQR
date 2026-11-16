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
  // Xác thực JWT tại chỗ thay vì gọi máy chủ Auth (getUser) ở mỗi lần render.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !claims.email) return null;

  // Chỉ đọc; ghi khi lần đầu đăng nhập. (upsert cũ là một lệnh ghi ở mỗi lần chuyển trang.)
  const existing = await prisma.teacher.findUnique({ where: { id: claims.sub } });
  if (existing) return existing;
  return prisma.teacher.upsert({
    where: { id: claims.sub },
    update: {},
    create: {
      id: claims.sub,
      email: claims.email,
      name: (claims.user_metadata?.name as string | undefined) ?? null,
    },
  });
});

export async function requireTeacher() {
  const t = await getTeacher();
  if (!t) redirect("/login");
  return t;
}
