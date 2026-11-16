"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { X } from "@/components/icons";
import { Button, cx } from "@/components/ui";

/** Bảng trượt từ dưới lên: lưới số câu để nhảy nhanh. */
export function QuestionNav({
  open,
  onClose,
  total,
  current,
  isAnswered,
  isFlagged,
  onPick,
  onReview,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  current: number;
  isAnswered: (i: number) => boolean;
  isFlagged: (i: number) => boolean;
  onPick: (i: number) => void;
  onReview: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Danh sách câu hỏi">
          <motion.div className="absolute inset-0 bg-ink/55" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.28 }}
            className="relative mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col border-[3px] border-b-0 border-ink bg-white"
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 bg-ink/25" aria-hidden />
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <p className="font-display text-[30px] font-bold leading-none text-ink">Danh sách câu hỏi</p>
              <button onClick={onClose} className="grid h-10 w-10 place-items-center border-2 border-ink text-ink hover:bg-sun" aria-label="Đóng">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-4">
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: total }, (_, i) => {
                  const done = isAnswered(i);
                  const flag = isFlagged(i);
                  return (
                    <button
                      key={i}
                      onClick={() => onPick(i)}
                      aria-label={`Câu ${i + 1}${done ? ", đã trả lời" : ", chưa trả lời"}${flag ? ", đã đánh dấu" : ""}`}
                      aria-current={i === current ? "true" : undefined}
                      className={cx(
                        "relative h-12 border-2 font-display text-[24px] font-bold tabular-nums transition-colors",
                        done ? "border-ink bg-mint text-ink" : "border-dashed border-ink/45 bg-white text-ink-soft",
                        i === current && "border-solid !border-accent outline-3 outline-offset-1 outline-accent",
                      )}
                    >
                      {i + 1}
                      {flag && <span className="absolute right-0.5 top-0.5 h-2 w-2 bg-sun outline-2 outline-ink" aria-hidden />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 border-2 border-ink bg-mint" /> Đã trả lời
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 border-2 border-dashed border-ink/45" /> Chưa trả lời
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-sun outline-2 outline-ink" /> Đánh dấu
                </span>
              </div>
            </div>
            <div className="border-t-2 border-ink bg-accent-soft px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <Button size="lg" variant="secondary" className="w-full" onClick={onReview}>
                Xem lại và nộp bài
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
