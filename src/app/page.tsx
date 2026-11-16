import { redirect } from "next/navigation";

/**
 * Trang gốc dành cho giảng viên: middleware chuyển tới /dashboard nếu đã đăng nhập, ngược lại tới /login.
 * Học viên vào thẳng phòng qua QR (/j/<mã>) hoặc nhập mã ở /j.
 */
export default function Home() {
  redirect("/login");
}
