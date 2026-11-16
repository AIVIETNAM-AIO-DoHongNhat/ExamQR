/** Biến môi trường bắt buộc để chạy phần có CSDL và đăng nhập (xem .env.example). */
const REQUIRED = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PARTICIPANT_TOKEN_SECRET",
] as const;

/** Tên các biến còn thiếu (chỉ gọi ở server). Rỗng nghĩa là đã cấu hình đủ. */
export function missingEnv(): string[] {
  return REQUIRED.filter((k) => !process.env[k]?.trim());
}

/** Supabase có đủ URL và anon key để tạo client chưa (dùng được ở middleware). */
export const hasSupabaseEnv = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
