"use client";

import type { PlayState } from "@/lib/play-types";

const RULES = [
  "Được chuyển qua lại giữa các câu và sửa đáp án trước khi nộp.",
  "Đáp án được lưu ngay khi chọn.",
  "Hết giờ, hệ thống tự nộp bài với các đáp án đã lưu.",
  "Nếu mất mạng hoặc lỡ đóng trang, mở lại đường dẫn trên cùng máy để làm tiếp.",
];

export function WaitingRoom({ state, onLeave }: { state: Extract<PlayState, { kind: "lobby" }>; onLeave: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2.5 text-[15px]" role="status">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping bg-mint/60" />
          <span className="relative inline-flex h-2.5 w-2.5 bg-mint" />
        </span>
        <span className="font-semibold text-ink">Đã vào phòng</span>
        <span className="text-muted">·</span>
        <span className="font-mono text-ink-soft">SBD {state.sbd}</span>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Đồng chí kiểm tra số báo danh trên màn chiếu và chờ giảng viên bắt đầu.
      </p>

      <section className="px-card mt-7">
        <div className="px-5 pb-4 pt-5">
          <p className="font-display text-[17px] font-bold tracking-[0.06em] text-ink-soft">Bài kiểm tra</p>
          <p className="mt-1 text-[20px] font-bold leading-snug text-ink">{state.examTitle}</p>
        </div>
        <div className="grid grid-cols-2 divide-x-2 divide-ink border-t-2 border-ink bg-accent-soft">
          <div className="px-5 py-3">
            <p className="font-display text-[17px] font-bold tracking-[0.06em] text-ink-soft">Số câu</p>
            <p className="font-display text-[46px] font-bold leading-none text-accent">{state.total}</p>
          </div>
          <div className="px-5 py-3">
            <p className="font-display text-[17px] font-bold tracking-[0.06em] text-ink-soft">Thời gian</p>
            <p className="font-display text-[46px] font-bold leading-none text-accent">
              {state.durationMin} <span className="text-base font-medium text-muted">phút</span>
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-[26px] font-bold leading-none text-ink">Quy định làm bài</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {RULES.map((r, i) => (
            <li key={i} className="flex gap-3.5 text-[15px] leading-relaxed text-ink-soft">
              <span className="grid h-7 w-7 shrink-0 place-items-center border-2 border-ink bg-sun font-display text-[19px] font-bold leading-none text-ink">{i + 1}</span>
              {r}
            </li>
          ))}
        </ol>
      </section>

      <button
        className="mt-auto self-center px-3 pt-6 text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        onClick={onLeave}
      >
        Nhập nhầm số báo danh? Nhập lại
      </button>
    </div>
  );
}
