"use client";

import { useState } from "react";
import type { PlayState } from "@/lib/play-types";
import { fmtScore } from "@/lib/format";
import { PASS_SCORE } from "@/lib/stats";
import { Check, Info, X } from "@/components/icons";
import { Badge, PixelRule, cx } from "@/components/ui";

const LETTERS = "ABCDEF";

export function ResultScreen({ state }: { state: Extract<PlayState, { kind: "result" }> }) {
  const pass = state.score >= PASS_SCORE;
  const [onlyWrong, setOnlyWrong] = useState(false);

  const items = (state.review ?? []).map((q, i) => ({ q, i, right: q.options.some((o) => o.chosen && o.isCorrect) }));
  const shown = onlyWrong ? items.filter((x) => !x.right) : items;

  return (
    <div className="flex flex-col">
      <section className="px-card mt-1">
        <div className="flex items-center justify-between border-b-[3px] border-ink bg-ink-deep px-5 py-2.5">
          <p className="font-display text-[20px] font-bold tracking-[0.06em] text-on-dark">KẾT QUẢ</p>
          <p className="border-2 border-ink bg-sun px-2 font-display text-[18px] font-bold text-ink">SBD {state.sbd}</p>
        </div>
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <p className={cx("font-display text-[128px] font-extrabold leading-[0.85] tabular-nums [text-shadow:6px_6px_0_var(--color-sun)]", pass ? "text-accent" : "text-ink")}>{fmtScore(state.score)}</p>
          <PixelRule className="mt-5" />
          <p className="mt-3 font-display text-[20px] font-semibold tracking-[0.04em] text-muted">điểm, thang 10</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[15px] text-ink-soft">
              Đúng <span className="font-bold text-ink">{state.correct}</span>/{state.total} câu
            </span>
            {pass && <Badge tone="green">Đạt</Badge>}
          </div>
        </div>
      </section>

      {state.review ? (
        <section className="mt-8">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-[32px] font-bold leading-none text-ink">Xem lại bài làm</h2>
            <label className="ml-auto flex min-h-10 cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} className="h-5 w-5 accent-accent" />
              Chỉ câu sai
            </label>
          </div>
          {shown.length === 0 && <p className="mt-4 text-[15px] text-muted">Đồng chí không có câu sai nào.</p>}
          <div className="px-card mt-4 flex flex-col divide-y-2 divide-ink/15">
            {shown.map(({ q, i, right }) => (
              <div key={i} className="px-5 py-4">
                <div className="flex gap-3">
                  <span
                    className={cx("mt-0.5 grid h-6 w-6 shrink-0 place-items-center border-2 border-ink", right ? "bg-mint text-ink" : "bg-danger text-white")}
                    aria-label={right ? "Đúng" : "Sai"}
                  >
                    {right ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <p className="leading-relaxed text-ink">
                    <span className="mr-1.5 font-display text-[19px] font-bold text-accent">Câu {i + 1}.</span>
                    {q.content}
                  </p>
                </div>
                <ul className="mt-3 flex flex-col gap-1 pl-8">
                  {q.options.map((o, oi) => (
                    <li
                      key={o.id}
                      className={cx(
                        "flex items-start gap-2 px-2.5 py-1.5 text-[15px] leading-relaxed",
                        o.isCorrect && "border-l-4 border-ok bg-mint-soft",
                        o.chosen && !o.isCorrect && "border-l-4 border-danger bg-danger-soft",
                      )}
                    >
                      <span className={cx("w-4 shrink-0 font-display text-[19px] font-bold leading-[1.4]", o.isCorrect ? "text-ok" : o.chosen ? "text-danger" : "text-muted")}>{LETTERS[oi]}</span>
                      <span className={cx("flex-1", o.isCorrect ? "text-ok" : o.chosen ? "text-danger" : "text-ink-soft")}>{o.content}</span>
                      {o.chosen && <span className="shrink-0 text-[12px] font-medium text-muted">Đồng chí chọn</span>}
                    </li>
                  ))}
                </ul>
                {!q.options.some((o) => o.chosen) && <p className="mt-2 pl-8 text-[13px] text-muted">Câu này đồng chí chưa trả lời.</p>}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="px-card mt-8 flex items-start gap-3 px-4 py-3.5 text-[15px] leading-relaxed text-ink-soft">
          <span className="grid h-7 w-7 shrink-0 place-items-center border-2 border-ink bg-accent text-white">
            <Info className="h-4 w-4" aria-hidden />
          </span>
          <p>Đáp án chi tiết sẽ hiện tại đây khi giảng viên kết thúc buổi kiểm tra. Đồng chí vui lòng giữ nguyên trang này.</p>
        </div>
      )}
    </div>
  );
}
