"use client";

import { useState } from "react";
import { joinSession } from "@/server/play-actions";
import type { PlayState } from "@/lib/play-types";
import { Alert, Button } from "@/components/ui";

export function JoinForm({
  code,
  examTitle,
  onJoined,
  join = joinSession,
}: {
  code: string;
  examTitle: string;
  onJoined: (s: PlayState) => void;
  /** Cho phép trang xem thử truyền hàm giả. */
  join?: typeof joinSession;
}) {
  const [sbd, setSbd] = useState("");
  const [alpha, setAlpha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!sbd.trim()) return;
        setPending(true);
        setError(null);
        try {
          const r = await join(code, sbd);
          if (r.ok) onJoined(r.state);
          else setError(r.error);
        } catch {
          setError("Mất kết nối mạng. Đồng chí vui lòng thử lại.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="px-card relative mt-1 px-5 py-5">
        <span className="absolute -top-0.75 right-4 -translate-y-1/2 border-2 border-ink bg-sun px-2 font-display text-[16px] font-bold tracking-[0.06em] text-ink">
          PHÒNG {code}
        </span>
        <p className="font-display text-[17px] font-bold tracking-[0.06em] text-ink-soft">Bài kiểm tra</p>
        <p className="mt-1 text-[20px] font-bold leading-snug text-ink">{examTitle}</p>
      </div>

      <label className="mt-8 flex flex-col gap-2">
        <span className="font-display text-[32px] font-bold leading-none text-ink">Số báo danh</span>
        <span id="sbd-help" className="text-sm text-muted">
          Đồng chí nhập số báo danh do giảng viên cung cấp, ví dụ 015.
        </span>
        <input
          value={sbd}
          onChange={(e) => setSbd(e.target.value.toUpperCase())}
          inputMode={alpha ? "text" : "numeric"}
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
          maxLength={20}
          aria-describedby="sbd-help"
          className="mt-2 h-18 border-[3px] border-ink bg-white text-center font-display text-[44px] font-bold tracking-[0.2em] text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)]"
        />
      </label>
      <button
        type="button"
        className="mt-3 self-center px-3 py-2 text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
        onClick={() => setAlpha((a) => !a)}
      >
        {alpha ? "Dùng bàn phím số" : "Số báo danh có chữ cái?"}
      </button>
      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}
      <Button type="submit" size="lg" className="mt-auto w-full" disabled={pending || !sbd.trim()}>
        {pending ? "Đang vào phòng…" : "Vào phòng"}
      </Button>
    </form>
  );
}
