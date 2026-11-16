"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import type { BoardState } from "@/lib/board-types";
import { Play } from "@/components/icons";
import { buttonClass, cx } from "@/components/ui";

const STEPS = ["Quét mã QR bằng điện thoại", "Nhập số báo danh", "Chờ giảng viên bắt đầu"];

/**
 * Địa chỉ học viên mở khi quét QR. Không dùng thẳng địa chỉ giảng viên đang mở: nếu đó là link
 * của một bản deploy (examqr-xxxx.vercel.app), Vercel bắt đăng nhập. Thứ tự ưu tiên:
 * NEXT_PUBLIC_APP_URL (tự đặt, ví dụ tên miền riêng) → tên miền production Vercel tự cung cấp → địa chỉ hiện tại.
 */
function publicOrigin() {
  const own = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (own) return own.replace(/\/+$/, "");
  const prod = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod}`;
  return window.location.origin;
}

export function Lobby({
  state,
  busy,
  onStart,
  onKick,
}: {
  state: BoardState;
  busy: boolean;
  onStart: () => void;
  onKick: (pid: string) => void;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(publicOrigin()), []);
  const joinUrl = `${origin}/j/${state.code}`;

  const bySbd = useMemo(() => new Map(state.participants.map((p) => [p.sbd, p])), [state.participants]);
  const joined = state.participants.length;
  const total = state.roster.length;
  const full = joined >= total && total > 0;

  // Lưới tự co theo sĩ số, đến khoảng 100 ô.
  const cols = total <= 20 ? 5 : total <= 40 ? 8 : total <= 64 ? 10 : 12;

  return (
    <div className="grid h-full grid-cols-[minmax(340px,34%)_1fr] gap-6 p-6 2xl:gap-8 2xl:p-8">
      {/* QR */}
      {/* QR co theo chỗ trống còn lại trong khung, nên phóng to trang hay màn hình thấp cũng không tràn. */}
      <section className="px-card m-1 flex min-h-0 flex-col overflow-y-auto p-6 2xl:p-8">
        <p className="shrink-0 font-display text-[20px] font-bold tracking-[0.06em] text-ink-soft">Vào phòng kiểm tra</p>
        <p className="shrink-0 font-display text-[clamp(2.2rem,3vw,3rem)] font-bold leading-none text-ink">Quét mã bằng điện thoại</p>
        <div className="flex min-h-36 flex-1 items-center justify-center py-4">
          <div className="aspect-square h-full max-h-[min(24vw,42vh)] max-w-full border-[3px] border-ink bg-white p-[4%] shadow-[6px_6px_0_0_var(--color-sun)]">
            {origin && <QRCodeSVG value={joinUrl} size={360} level="M" marginSize={0} fgColor="#1a1d3a" style={{ display: "block", width: "100%", height: "100%" }} />}
          </div>
        </div>
        <div className="shrink-0 border-t-2 border-dashed border-ink/30 pt-4">
          <p className="text-[15px] text-muted">
            Hoặc mở <span className="break-all text-ink-soft">{origin.replace(/^https?:\/\//, "")}/j</span> và nhập mã
          </p>
          <p className="mt-2 w-fit border-[3px] border-ink bg-accent px-3 py-1 font-display text-[clamp(3rem,min(5.5vw,9vh),5.25rem)] font-extrabold leading-none tracking-[0.16em] text-white">{state.code}</p>
        </div>
        {/* Các bước chỉ để nhắc; màn hình thấp (hoặc phóng to nhiều) thì ẩn để nhường chỗ cho QR. */}
        <ol className="mt-5 flex shrink-0 flex-col gap-2 [@media(max-height:720px)]:hidden">
          {STEPS.map((s, i) => (
            <li key={i} className="flex items-center gap-3 text-[clamp(1rem,1.3vw,1.125rem)] text-ink-soft">
              <span className="grid h-7 w-7 shrink-0 place-items-center border-2 border-ink bg-sun font-display text-[19px] font-bold text-ink">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      {/* Danh sách đã vào */}
      <section className="flex min-h-0 flex-col">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-display text-[22px] font-bold tracking-[0.06em] text-ink-soft">Học viên đã vào phòng</p>
            <p className="font-display text-[clamp(4rem,6.5vw,6rem)] font-extrabold leading-[0.85] tabular-nums text-ink">
              {joined}
              <span className="text-[0.5em] font-medium text-muted"> / {total}</span>
            </p>
          </div>
          <button
            onClick={onStart}
            disabled={busy || joined === 0}
            className={cx(buttonClass(full ? "primary" : "secondary"), "h-16 gap-3 px-8 text-[28px]")}
          >
            <Play className="h-4 w-4 fill-current" aria-hidden />
            {busy ? "Đang bắt đầu…" : "Bắt đầu làm bài"}
          </button>
        </div>
        <div className="px-track mt-5 h-6">
          <div className="h-full bg-accent px-meter transition-[width] duration-500" style={{ width: `${total ? (joined / total) * 100 : 0}%` }} />
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto p-1">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {state.roster.map((sbd) => {
              const p = bySbd.get(sbd);
              return (
                <button
                  key={sbd}
                  onClick={() => p && onKick(p.id)}
                  disabled={!p}
                  title={p ? "Bấm để mời ra nếu nhập nhầm số báo danh" : "Chưa vào phòng"}
                  className={cx(
                    "py-2.5 text-center font-display text-[clamp(1.6rem,2.3vw,2.4rem)] font-bold leading-none transition-colors",
                    p ? "px-tile bg-mint text-ink hover:bg-danger-soft" : "border-2 border-dashed border-ink/25 bg-white/60 text-ink/30",
                  )}
                >
                  {sbd}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-4 text-[15px] text-muted">Bấm vào ô đã sáng để mời ra nếu học viên nhập nhầm số báo danh.</p>
      </section>
    </div>
  );
}
