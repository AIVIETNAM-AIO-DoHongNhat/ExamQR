import { PASS_SCORE } from "@/lib/stats";
import { cx } from "./ui";

/** Biểu đồ phổ điểm 10 nhóm; cột từ ngưỡng đạt tô màu nhấn. Dùng chung cho màn tổng kết và báo cáo. */
export function ScoreHistogram({ bins, size = "md", className }: { bins: number[]; size?: "md" | "lg"; className?: string }) {
  const max = Math.max(1, ...bins);
  // Vạch chia trục tung: 0, nửa, tối đa (làm tròn lên số chẵn)
  const top = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const ticks = top <= 1 ? [0, 1] : [0, top / 2, top];
  const lg = size === "lg";

  return (
    <div className={cx("flex flex-col", className)}>
      <div className="flex min-h-0 flex-1 gap-3">
        {/* Trục tung */}
        <div className={cx("relative w-6 shrink-0 tabular-nums text-muted", lg ? "text-sm" : "text-xs")} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex min-h-0 flex-1 items-end gap-[3%] border-b-[3px] border-ink">
          {ticks.slice(1).map((t) => (
            <span key={t} className="absolute inset-x-0 border-t-2 border-dashed border-ink/15" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden />
          ))}
          {bins.map((c, i) => (
            <div key={i} className="relative flex h-full flex-1 flex-col justify-end" title={`${c} học viên đạt ${i}${i === 9 ? "–10" : ` đến dưới ${i + 1}`} điểm`}>
              {c > 0 && (
                <span className={cx("mb-1 text-center font-display font-bold tabular-nums text-ink", lg ? "text-[26px]" : "text-[18px]")}>{c}</span>
              )}
              <div
                className={cx("w-full transition-[height] duration-700 ease-out", i >= PASS_SCORE ? "border-2 border-b-0 border-ink bg-accent" : "border-2 border-b-0 border-ink bg-paper")}
                style={{ height: `${(c / top) * 100}%`, minHeight: c ? 3 : 0 }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-6 shrink-0" />
        <div className={cx("flex flex-1 gap-[3%] pt-2 text-center tabular-nums text-muted", lg ? "text-sm" : "text-xs")}>
          {bins.map((_, i) => (
            <span key={i} className="flex-1">
              {i === 9 ? "9–10" : i}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
