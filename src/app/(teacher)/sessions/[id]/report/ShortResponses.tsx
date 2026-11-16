"use client";

import { useState, useTransition } from "react";
import { gradeShortAnswer } from "@/server/teacher-actions";
import { Check, X } from "@/components/icons";
import { cx } from "@/components/ui";

type Item = { text: string; normalized: string; count: number; accepted: boolean };

/** Các câu trả lời ngắn khác nhau của cả lớp; giảng viên bấm để chấp nhận / không chấp nhận. */
export function ShortResponses({ sessionId, questionId, items }: { sessionId: string; questionId: string; items: Item[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) return <p className="text-[13px] text-muted">Chưa có ai trả lời.</p>;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="no-print text-[12px] text-muted">Bấm vào một câu trả lời để đổi giữa chấp nhận và không chấp nhận. Điểm của các bài liên quan được tính lại ngay.</p>
      {items.map((it) => (
        <button
          key={it.normalized}
          type="button"
          disabled={pending}
          onClick={() => {
            setBusy(it.normalized);
            setError(null);
            start(async () => {
              try {
                await gradeShortAnswer(sessionId, questionId, it.normalized, !it.accepted);
              } catch {
                setError("Không lưu được, thử lại sau.");
              } finally {
                setBusy(null);
              }
            });
          }}
          title={it.accepted ? "Bấm để không chấp nhận" : "Bấm để chấp nhận"}
          className={cx(
            "flex items-center gap-2 border-l-4 px-2.5 py-1.5 text-left text-[13px] transition-opacity disabled:cursor-wait",
            it.accepted ? "border-ok bg-mint-soft text-ok" : "border-danger bg-danger-soft text-danger",
            busy === it.normalized && "opacity-50",
          )}
        >
          {it.accepted ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden /> : <X className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />}
          <span className="min-w-0 flex-1 break-words">{it.text}</span>
          <span className="shrink-0 tabular-nums text-muted">{it.count}</span>
        </button>
      ))}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
