/**
 * Tạo tài khoản giáo viên (không mở đăng ký công khai).
 *   npm run create-teacher -- email@donvi.vn "Mật khẩu" "Tên hiển thị"
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Cách dùng: npm run create-teacher -- <email> <mật khẩu> ["Tên"]');
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : {},
  });
  if (error) throw error;

  const prisma = new PrismaClient();
  await prisma.teacher.upsert({
    where: { id: data.user.id },
    update: { email, name: name ?? null },
    create: { id: data.user.id, email, name: name ?? null },
  });
  await prisma.$disconnect();
  console.log(`Đã tạo giáo viên ${email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
