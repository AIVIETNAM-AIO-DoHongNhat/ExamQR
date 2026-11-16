import type { ReactNode } from "react";
import { cx } from "@/components/ui";

/** Dải số liệu cố định trên màn chiếu: các ô phân cách bằng kẻ dọc, số lớn dễ đọc từ cuối lớp. */
export function StatsStrip({ items, dark }: { items: { label: string; value: ReactNode; tone?: "warn" | "danger" }[]; dark?: boolean }) {
  return (
    <div
      className={cx(
        "grid",
        dark ? "divide-x-2 divide-white/20 border-[3px] border-ink bg-ink-deep text-white" : "px-card divide-x-2 divide-ink",
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => (
        <div key={it.label} className="px-6 py-3.5">
          <p className={cx("font-display text-[20px] font-bold tracking-[0.06em]", dark ? "text-on-dark-muted" : "text-ink-soft")}>{it.label}</p>
          <p
            className={cx(
              "mt-1 font-display text-[clamp(3rem,4.4vw,4.5rem)] font-bold leading-none tabular-nums",
              it.tone === "danger" ? "text-danger" : it.tone === "warn" ? "text-warn" : dark ? "text-white" : "text-ink",
            )}
          >
            {it.value}
          </p>
        </div>
      ))}
    </div>
  );
}
