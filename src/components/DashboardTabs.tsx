"use client";

import { useSearchParams } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { cx } from "./ui";

export const DASHBOARD_TABS = ["exams", "classes", "sessions"] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export function useDashboardTab(): DashboardTab {
  const t = useSearchParams().get("tab");
  return DASHBOARD_TABS.find((k) => k === t) ?? "exams";
}

/**
 * Đổi tab ngay trên trình duyệt, không gọi lại server: dữ liệu cả ba tab đã có sẵn trong trang.
 * Next.js đồng bộ history.replaceState với useSearchParams nên thanh điều hướng cũng đổi theo.
 */
export function switchDashboardTab(e: MouseEvent, key: DashboardTab) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // để mở tab mới bình thường
  e.preventDefault();
  window.history.replaceState(null, "", `/dashboard?tab=${key}`);
}

export function DashboardTabs({ labels, panels }: { labels: Record<DashboardTab, ReactNode>; panels: Record<DashboardTab, ReactNode> }) {
  const active = useDashboardTab();
  return (
    <>
      <nav className="flex w-fit max-w-full overflow-x-auto border-2 border-ink bg-white" aria-label="Mục">
        {DASHBOARD_TABS.map((key, i) => (
          <a
            key={key}
            href={`/dashboard?tab=${key}`}
            onClick={(e) => switchDashboardTab(e, key)}
            aria-current={active === key ? "page" : undefined}
            className={cx(
              "whitespace-nowrap px-4 py-1.5 font-display text-[20px] font-semibold tracking-[0.04em] transition-colors",
              i > 0 && "border-l-2 border-ink",
              active === key ? "bg-accent text-white" : "text-ink-soft hover:bg-accent-soft hover:text-ink",
            )}
          >
            {labels[key]}
          </a>
        ))}
      </nav>
      {panels[active]}
    </>
  );
}
