import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";

const TEACHER_PREFIXES = ["/dashboard", "/exams", "/classes", "/sessions"];

/** Làm mới cookie đăng nhập Supabase và chặn trang giảng viên khi chưa đăng nhập. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Chưa cấu hình Supabase: để trang tự hiện hướng dẫn cấu hình thay vì sập ở đây.
  if (!hasSupabaseEnv()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims xác thực chữ ký JWT ngay tại chỗ (khoá công khai JWKS được cache),
  // không gọi tới máy chủ Auth mỗi lần chuyển trang như getUser. Token hết hạn thì tự làm mới.
  const { data: claimsData } = await supabase.auth.getClaims();
  const data = { user: claimsData?.claims ?? null };
  const path = request.nextUrl.pathname;

  if (!data.user && TEACHER_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = data.user ? "/dashboard" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (data.user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Trang học viên (/j) và API không cần phiên Supabase.
  matcher: ["/", "/login","/dashboard/:path*", "/exams/:path*", "/classes/:path*", "/sessions/:path*"],
};
