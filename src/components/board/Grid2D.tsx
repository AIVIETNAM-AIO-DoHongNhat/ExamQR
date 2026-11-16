"use client";

import type { BoardParticipant } from "@/lib/board-types";
import { Check } from "@/components/icons";
import { cx } from "@/components/ui";
import type { Pulse } from "./types";

/** Bảng theo dõi: chế độ mặc định của màn chiếu. Bấm vào ô để cho học viên vào lại khi đổi máy. */
export function Grid2D({
  participants,
  totalQuestions,
  pulses,
  onRejoin,
}: {
  participants: BoardParticipant[];
  totalQuestions: number;
  pulses: Pulse[];
  onRejoin: (pid: string) => void;
}) {
  const n = participants.length;
  const cols = n <= 16 ? 4 : n <= 30 ? 6 : n <= 48 ? 8 : n <= 70 ? 10 : 12;
  const lastPulse = new Map<string, number>();
  for (const p of pulses) lastPulse.set(p.pid, p.id);

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {participants.map((p) => {
          const pct = totalQuestions ? p.answered / totalQuestions : 0;
          const pulse = lastPulse.get(p.id);
          return (
            <button
              // Đổi key khi có tiến độ mới để hiệu ứng nháy viền chạy lại.
              key={`${p.id}:${pulse ?? 0}`}
              type="button"
              onClick={() => !p.finished && onRejoin(p.id)}
              disabled={p.finished}
              title={p.finished ? "Đã nộp bài" : "Bấm để cho vào lại khi học viên đổi máy"}
              className={cx(
                "px-tile px-3 pb-2.5 pt-2 text-left transition-colors",
                pulse != null && "cell-pulse",
                p.finished ? "bg-mint" : "bg-white hover:bg-sun-soft",
              )}
            >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-[clamp(1.6rem,2.2vw,2.3rem)] font-bold leading-none text-ink">{p.sbd}</span>
                  {p.finished ? (
                    <span className="flex items-center gap-1 font-display text-[18px] font-bold text-ink">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> Đã nộp
                    </span>
                  ) : (
                    <span className="font-display text-[20px] font-semibold tabular-nums text-muted">
                      {p.answered}/{totalQuestions}
                    </span>
                  )}
                </span>
                <span className={cx("mt-2 block h-2.5 border-2 border-ink", p.finished ? "bg-white/60" : "bg-paper")}>
                  <span
                    className={cx("px-meter block h-full transition-[width] duration-500 ease-out", p.finished ? "bg-ok" : "bg-accent")}
                    style={{ width: `${pct * 100}%` }}
                  />
                </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
