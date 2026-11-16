"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cx } from "./ui";
import { switchDashboardTab } from "./DashboardTabs";

const NAV = [
  ["exams", "Đề kiểm tra", ["/exams"]],
  ["classes", "Lớp", ["/classes"]],
  ["sessions", "Buổi kiểm tra", ["/sessions"]],
] as const;

/** Điều hướng chính của giảng viên trên thanh tối; mục đang xem là ô vàng. */
export function TeacherNav() {
  const path = usePathname();
  const tab = useSearchParams().get("tab") ?? "exams";
  return (
    <nav className="ml-8 hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
      {NAV.map(([key, label, prefixes]) => {
        const active = path === "/dashboard" ? tab === key : prefixes.some((p) => path.startsWith(p));
        return (
          <Link
            key={key}
            href={`/dashboard?tab=${key}`}
            // Đang ở dashboard thì đổi tab tại chỗ, không tải lại từ server.
            onClick={path === "/dashboard" ? (e) => switchDashboardTab(e, key) : undefined}
            aria-current={active ? "page" : undefined}
            className={cx(
              "border-2 px-3.5 py-0.5 font-display text-[20px] font-semibold tracking-[0.04em] transition-colors",
              active ? "border-ink bg-sun text-ink" : "border-transparent text-on-dark-muted hover:border-white/25 hover:text-on-dark",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
