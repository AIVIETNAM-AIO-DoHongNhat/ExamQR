"use client";

import { useMemo } from "react";
import type { BoardState } from "@/lib/board-types";
import { fmtScore } from "@/lib/format";
import { HONOR_SCORE, PASS_SCORE, honorRoll, scoreSummary } from "@/lib/stats";
import { ScoreHistogram } from "@/components/ScoreHistogram";
import { PixelRule, cx } from "@/components/ui";

const pct = (r: number | null) => (r == null ? "–" : `${Math.round(r * 100)}%`);

/** Màn tổng kết trên máy chiếu: thống kê chung của lớp, biểu dương, câu cần trao đổi thêm. */
export function Summary({ state }: { state: BoardState }) {
  const scores = useMemo(() => state.participants.map((p) => p.score).filter((x): x is number => x != null), [state.participants]);
  const s = useMemo(() => scoreSummary(scores), [scores]);
  const honor = useMemo(() => honorRoll(state.participants), [state.participants]);
  const absent = state.roster.length - state.participants.length;

  return (
    // Màn hình thấp (hoặc phóng to nhiều) thì cuộn được thay vì để các khung đè lên nhau.
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 2xl:p-8">
      <div className="px-card mx-1 mt-1 grid shrink-0 grid-cols-4 divide-x-2 divide-ink">
        <Stat label="Điểm trung bình" value={fmtScore(s.avg == null ? null : Math.round(s.avg * 100) / 100)} accent />
        <Stat label={`Tỉ lệ đạt (từ ${PASS_SCORE} điểm)`} value={pct(s.passRate)} />
        <Stat label="Hoàn thành" value={`${s.count}`} />
        <Stat label="Vắng" value={`${absent}`} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.15fr] gap-6">
        <section className="px-card m-1 flex min-h-0 flex-col overflow-y-auto p-6">
          <h3 className="font-display text-[clamp(2rem,2.6vw,2.6rem)] font-bold leading-none text-ink">Biểu dương</h3>
          <p className="mt-1 text-[15px] text-muted">
            {honor.kind === "honor" && `Học viên đạt từ ${HONOR_SCORE} điểm trở lên, xếp theo số báo danh`}
            {honor.kind === "top" && "Học viên đạt điểm cao nhất, xếp theo số báo danh"}
            {honor.kind === "none" && "Chưa có học viên đạt mức biểu dương"}
          </p>
          <PixelRule className="mt-4" />
          <div className="mt-5 grid grid-cols-4 gap-3">
            {honor.items.map((p) => (
              <div key={p.sbd} className="px-tile bg-sun px-3 py-2.5 text-center">
                <p className="font-display text-[clamp(1.9rem,2.6vw,2.6rem)] font-extrabold leading-none text-ink">{p.sbd}</p>
                <p className="mt-1 font-display text-[20px] font-semibold tabular-nums text-ink">{fmtScore(p.score)} điểm</p>
              </div>
            ))}
          </div>
          {honor.more > 0 && <p className="mt-3 text-[15px] text-muted">và {honor.more} học viên khác</p>}
        </section>

        {/* Phổ điểm luôn giữ đủ chỗ cho biểu đồ; khi thiếu chỗ thì danh sách câu bên dưới co lại và cuộn. */}
        <div className="flex min-h-0 flex-col gap-6">
          <section className="px-card m-1 flex min-h-64 flex-1 flex-col p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-display text-[clamp(2rem,2.6vw,2.6rem)] font-bold leading-none text-ink">Phổ điểm</h3>
              <span className="flex items-center gap-4 text-[13px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 border-2 border-ink bg-accent" /> Đạt
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 border-2 border-ink bg-paper" /> Chưa đạt
                </span>
              </span>
            </div>
            <ScoreHistogram bins={s.bins} size="lg" className="mt-4 min-h-36 flex-1" />
          </section>

          {state.hardest && state.hardest.length > 0 && (
            <section className="px-card m-1 flex min-h-40 flex-col">
              <h3 className="shrink-0 px-6 pb-3 pt-5 font-display text-[clamp(1.7rem,2.2vw,2.2rem)] font-bold leading-none text-ink">Câu cần trao đổi thêm</h3>
              <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full">
                <tbody>
                  {state.hardest.map((q) => (
                    <tr key={q.index} className="border-t-2 border-ink/15">
                      <td className="w-24 py-3 pl-6 align-top font-display text-[22px] font-bold leading-tight text-accent">Câu {q.index}</td>
                      <td className="py-3 pr-4 align-top text-[17px] leading-snug text-ink">
                        <span className="line-clamp-2">{q.content}</span>
                      </td>
                      <td className="w-32 whitespace-nowrap py-3 pr-6 text-right align-top font-display text-[26px] font-bold leading-tight tabular-nums text-danger">
                        {pct(q.rate)} <span className="text-[13px] text-muted">đúng</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-6 py-4 2xl:py-5">
      <p className="font-display text-[20px] font-bold tracking-[0.06em] text-ink-soft">{label}</p>
      <p className={cx("mt-1 font-display text-[clamp(3rem,4.6vw,4.75rem)] font-bold leading-none tabular-nums", accent ? "text-accent" : "text-ink")}>
        {value}
      </p>
    </div>
  );
}
