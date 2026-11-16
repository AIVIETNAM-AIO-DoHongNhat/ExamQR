"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAnswer, submitExam } from "@/server/play-actions";
import type { AnswerResult, PlayQuestion, PlayState } from "@/lib/play-types";
import { SHORT_MAX, STATEMENT_LABELS, TYPE_LABEL, isComplete, type Response } from "@/lib/question-types";
import { clockOffset, useServerNow } from "@/lib/use-session-channel";
import { fmtClock } from "@/lib/format";
import { useConfirm } from "@/components/Dialog";
import { Check, ChevronLeft, ChevronRight, Clock, Flag, LayoutGrid, WifiOff } from "@/components/icons";
import { Alert, Button, cx } from "@/components/ui";
import { QuestionNav } from "./QuestionNav";

const LETTERS = "ABCDEF";
type PlayView = Extract<PlayState, { kind: "play" }>;
type SaveStatus = "idle" | "saving" | "saved" | "error";

export type ExamApi = {
  save: (code: string, questionId: string, response: Response) => Promise<AnswerResult>;
  submit: (code: string) => Promise<AnswerResult>;
};
const serverApi: ExamApi = { save: saveAnswer, submit: submitExam };

export function ExamScreen({
  state,
  onState,
  refresh,
  api = serverApi,
  initialView = "question",
}: {
  state: PlayView;
  onState: (s: PlayState) => void;
  refresh: () => Promise<void>;
  /** Trang xem thử truyền hàm giả; mặc định gọi server. */
  api?: ExamApi;
  initialView?: "question" | "review";
}) {
  const offset = useMemo(() => clockOffset(state.serverNow), [state.serverNow]);
  const now = useServerNow(offset);
  const startAt = new Date(state.startedAt).getTime();
  const endAt = new Date(state.endsAt).getTime();
  const timeUp = now >= endAt;

  const qs = state.questions;
  const [index, setIndex] = useState(() => {
    const first = qs.findIndex((q) => !isComplete(state.chosen[q.id], q.options.length));
    return first === -1 ? 0 : first;
  });
  const [chosen, setChosen] = useState<Record<string, Response>>(state.chosen);
  const [flags, setFlags] = useFlags(state.sessionId);
  const [view, setView] = useState<"question" | "review">(initialView);
  const [navOpen, setNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  const [ask, dialog] = useConfirm();

  /* ---------- Hàng đợi lưu đáp án: gửi lần lượt, mất mạng thì thử lại ---------- */
  const queue = useRef(new Map<string, Response>());
  const inflight = useRef<Promise<boolean> | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const run = useCallback(async (): Promise<boolean> => {
    setSaveStatus("saving");
    try {
      while (queue.current.size) {
        const [qid, resp] = queue.current.entries().next().value as [string, Response];
        const r = await api.save(state.code, qid, resp);
        if (!r.ok) {
          if (r.state) {
            queue.current.clear();
            onState(r.state);
            return false;
          }
          setError(r.error);
          setSaveStatus("error");
          return false;
        }
        // Chỉ bỏ khỏi hàng đợi nếu học viên chưa đổi đáp án trong lúc gửi.
        if (queue.current.get(qid) === resp) queue.current.delete(qid);
      }
      setError(null);
      setSaveStatus("saved");
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }, [api, state.code, onState]);

  /** Gửi mọi đáp án đang chờ; gọi chồng nhau thì dùng chung một lượt gửi. */
  const flush = useCallback((): Promise<boolean> => {
    if (inflight.current) return inflight.current;
    const p = run().then((ok) => {
      inflight.current = null;
      // Có đáp án mới chen vào đúng lúc lượt gửi vừa xong: gửi tiếp.
      return ok && queue.current.size ? flush() : ok;
    });
    inflight.current = p;
    return p;
  }, [run]);

  // Còn đáp án chưa gửi được: thử lại định kỳ và ngay khi có mạng.
  useEffect(() => {
    if (saveStatus !== "error") return;
    const id = setInterval(() => queue.current.size && flush(), 4000);
    const h = () => flush();
    window.addEventListener("online", h);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", h);
    };
  }, [saveStatus, flush]);

  // Hết giờ: hỏi server đến khi bài được chốt (server chờ thêm vài giây ân hạn cho độ trễ mạng).
  useEffect(() => {
    if (!timeUp) return;
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [timeUp, refresh]);

  // Câu trả lời ngắn: gõ đến đâu hiện đến đó, ngừng gõ một lúc mới gửi.
  const typing = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef(chosen);
  latest.current = chosen;
  const choose = (qid: string, resp: Response, debounceMs = 0) => {
    if (timeUp || submitting) return;
    setChosen((c) => ({ ...c, [qid]: resp }));
    clearTimeout(typing.current.get(qid));
    const send = () => {
      typing.current.delete(qid);
      queue.current.set(qid, resp);
      void flush();
    };
    if (debounceMs) typing.current.set(qid, setTimeout(send, debounceMs));
    else send();
  };
  /** Đưa ngay vào hàng đợi các câu trả lời ngắn đang chờ ngừng gõ (khi chuyển câu, nộp bài). */
  const flushTyping = () => {
    for (const [qid, t] of typing.current) {
      clearTimeout(t);
      const r = latest.current[qid];
      if (r) queue.current.set(qid, r);
    }
    typing.current.clear();
  };

  const done = (q: PlayQuestion) => isComplete(chosen[q.id], q.options.length);
  const answeredCount = qs.filter(done).length;
  const unanswered = qs.map((q, i) => (done(q) ? -1 : i)).filter((i) => i >= 0);
  const flagged = qs.map((q, i) => (flags.has(q.id) ? i : -1)).filter((i) => i >= 0);

  async function doSubmit() {
    const left = unanswered.length;
    const ok = await ask({
      title: "Nộp bài?",
      message: (
        <>
          {left > 0 ? (
            <p>
              Còn <b className="font-semibold text-ink">{left} câu chưa trả lời</b>. Đồng chí vẫn nộp bài?
            </p>
          ) : (
            <p>Đồng chí đã trả lời đủ {qs.length} câu.</p>
          )}
          <p className="mt-2 text-muted">Sau khi nộp, đồng chí không sửa được đáp án.</p>
        </>
      ),
      confirmLabel: "Nộp bài",
      cancelLabel: "Làm tiếp",
    });
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    flushTyping();
    try {
      if (queue.current.size && !(await flush())) {
        setError("Còn đáp án chưa lưu được do mất mạng. Đồng chí kiểm tra kết nối rồi bấm nộp lại.");
        return;
      }
      const r = await api.submit(state.code);
      if (r.state) onState(r.state);
      else if (!r.ok) setError(r.error);
    } catch {
      setError("Mất kết nối mạng. Đồng chí bấm “Nộp bài” lần nữa.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Đếm ngược trước giờ làm bài ---------- */
  if (now < startAt) {
    const n = Math.ceil((startAt - now) / 1000);
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="font-display text-[26px] font-semibold tracking-[0.04em] text-muted">Bài kiểm tra bắt đầu sau</p>
        <AnimatePresence mode="popLayout">
          <motion.p
            key={n}
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "linear" }}
            className="mt-2 font-display text-[160px] font-extrabold leading-none tabular-nums text-accent [text-shadow:6px_6px_0_var(--color-sun)]"
          >
            {n}
          </motion.p>
        </AnimatePresence>
      </div>
    );
  }

  if (timeUp) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center" role="status">
        <span className="grid h-14 w-14 place-items-center border-[3px] border-ink bg-sun">
          <Clock className="h-7 w-7 text-ink" strokeWidth={2} aria-hidden />
        </span>
        <p className="mt-5 font-display text-[36px] font-bold leading-none text-ink">Đã hết giờ làm bài</p>
        <p className="mt-1 text-[15px] text-muted">Hệ thống đang nộp bài và tính điểm…</p>
      </div>
    );
  }

  const remainingMs = endAt - now;
  const q = qs[index];
  const isLast = index === qs.length - 1;
  const pending = queue.current.has(q.id) || typing.current.has(q.id);
  const qSave: SaveStatus = chosen[q.id] ? (pending ? (saveStatus === "error" ? "error" : "saving") : "saved") : "idle";
  const go = (i: number) => {
    flushTyping();
    if (queue.current.size) void flush();
    setIndex(i);
  };

  return (
    // Bù lề trên/dưới của khung để thanh trạng thái và thanh nút sát mép.
    <div className="-mb-6 -mt-6 flex flex-1 flex-col">
      {dialog}
      {/* Thanh trạng thái dính trên */}
      <div className="sticky top-0 z-20 -mx-4 border-b-[3px] border-ink bg-white sm:-mx-6">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Timer ms={remainingMs} />
          <span className="font-display text-[22px] font-semibold text-muted">
            <span className="font-bold tabular-nums text-ink">{answeredCount}</span>/{qs.length} câu
          </span>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setNavOpen(true)}>
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Danh sách
          </Button>
        </div>
        <div className="px-4 pb-2.5 sm:px-6">
          <div className="px-track h-3.5">
            <div className="h-full bg-accent px-meter transition-[width] duration-300" style={{ width: `${(answeredCount / qs.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {!online && (
        <Alert tone="warn" className="mt-4">
          <span className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" aria-hidden /> Mất kết nối mạng. Đáp án sẽ được gửi khi có mạng trở lại.
          </span>
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}

      {view === "review" ? (
        <SubmitReview
          total={qs.length}
          answered={answeredCount}
          unanswered={unanswered}
          flagged={flagged}
          submitting={submitting}
          onJump={(i) => {
            setIndex(i);
            setView("question");
          }}
          onBack={() => setView("question")}
          onSubmit={doSubmit}
        />
      ) : (
        <>
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={q.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex flex-col pt-6"
              aria-labelledby={`q-${q.id}`}
            >
              <div className="flex h-9 items-center gap-3">
                <p className="border-2 border-ink bg-sun px-2 font-display text-[20px] font-bold leading-tight tracking-[0.04em] text-ink">
                  CÂU {index + 1}/{qs.length}
                </p>
                {q.type !== "SINGLE" && <span className="font-display text-[17px] font-semibold tracking-[0.04em] text-muted">{TYPE_LABEL[q.type]}</span>}
                <SaveIndicator status={qSave} />
                <button
                  onClick={() =>
                    setFlags((f) => {
                      const n = new Set(f);
                      if (n.has(q.id)) n.delete(q.id);
                      else n.add(q.id);
                      return n;
                    })
                  }
                  aria-pressed={flags.has(q.id)}
                  className={cx(
                    "ml-auto flex h-9 items-center gap-1.5 border-2 px-2.5 font-display text-[18px] font-semibold tracking-[0.04em] transition-colors",
                    flags.has(q.id) ? "border-ink bg-sun text-ink" : "border-transparent text-muted hover:border-ink/30 hover:text-ink",
                  )}
                >
                  <Flag className={cx("h-3.5 w-3.5", flags.has(q.id) && "fill-ink")} aria-hidden />
                  {flags.has(q.id) ? "Đã đánh dấu" : "Đánh dấu"}
                </button>
              </div>
              <p id={`q-${q.id}`} className="px-card mt-4 whitespace-pre-wrap px-5 py-5 text-[1.2rem] font-semibold leading-normal text-ink">
                {q.content}
              </p>
              <QuestionInput q={q} value={chosen[q.id]} onChange={(r, debounceMs) => choose(q.id, r, debounceMs)} />
            </motion.section>
          </AnimatePresence>

          <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t-[3px] border-ink bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3.5 sm:-mx-6 sm:px-6">
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" className="flex-1 px-3" disabled={index === 0} onClick={() => go(index - 1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Câu trước
              </Button>
              {isLast ? (
                <Button
                  size="lg"
                  className="flex-1 px-3"
                  onClick={() => {
                    go(index);
                    setView("review");
                  }}
                >
                  Xem lại và nộp
                </Button>
              ) : (
                <Button size="lg" className="flex-1 px-3" onClick={() => go(index + 1)}>
                  Câu sau
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      <QuestionNav
        open={navOpen}
        onClose={() => setNavOpen(false)}
        total={qs.length}
        current={view === "question" ? index : -1}
        isAnswered={(i) => done(qs[i])}
        isFlagged={(i) => flags.has(qs[i].id)}
        onPick={(i) => {
          go(i);
          setView("question");
          setNavOpen(false);
        }}
        onReview={() => {
          setView("review");
          setNavOpen(false);
        }}
      />
    </div>
  );
}

/** Phần trả lời của một câu, theo dạng câu. */
function QuestionInput({ q, value, onChange }: { q: PlayQuestion; value: Response | undefined; onChange: (r: Response, debounceMs?: number) => void }) {
  if (q.type === "TRUE_FALSE") {
    const marks = value?.kind === "tf" ? value.marks : {};
    return (
      <div className="mt-7 flex flex-col gap-3">
        <p className="text-[14px] text-muted">Chọn Đúng hoặc Sai cho từng nhận định.</p>
        {q.options.map((o, i) => {
          const m = marks[o.id];
          return (
            <div key={o.id} role="radiogroup" aria-labelledby={`st-${o.id}`} className={cx("px-tile flex flex-col gap-3 p-3", m === undefined ? "bg-white" : "bg-accent-soft")}>
              <p id={`st-${o.id}`} className="flex gap-2.5 leading-relaxed text-ink">
                <span className="font-display text-[22px] font-bold leading-[1.15] text-accent">{STATEMENT_LABELS[i]})</span>
                <span className="flex-1">{o.content}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([true, false] as const).map((v) => {
                  const on = m === v;
                  return (
                    <button
                      key={String(v)}
                      role="radio"
                      aria-checked={on}
                      onClick={() => onChange({ kind: "tf", marks: { ...marks, [o.id]: v } })}
                      className={cx(
                        "flex h-12 items-center justify-center gap-2 border-2 font-display text-[22px] font-bold tracking-[0.04em] transition-[background-color,transform] active:translate-y-0.5",
                        on ? (v ? "border-ink bg-mint text-ink" : "border-ink bg-danger text-white") : "border-ink/40 bg-white text-ink-soft hover:border-ink",
                      )}
                    >
                      {on && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                      {v ? "Đúng" : "Sai"}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (q.type === "SHORT") {
    const text = value?.kind === "short" ? value.text : "";
    return (
      <div className="mt-7 flex flex-col gap-2">
        <label htmlFor={`a-${q.id}`} className="font-display text-[20px] font-semibold tracking-[0.04em] text-ink-soft">
          Câu trả lời của đồng chí
        </label>
        <textarea
          id={`a-${q.id}`}
          rows={3}
          maxLength={SHORT_MAX}
          value={text}
          onChange={(e) => onChange({ kind: "short", text: e.target.value }, 800)}
          placeholder="Gõ câu trả lời ngắn gọn…"
          className="px-tile w-full resize-none bg-white px-4 py-3 text-[1.1rem] leading-relaxed text-ink outline-none placeholder:text-muted/60 focus:border-accent"
        />
        <p className="text-[13px] text-muted">Viết đúng chính tả, có dấu. Không phân biệt chữ hoa, chữ thường.</p>
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-labelledby={`q-${q.id}`} className="mt-7 flex flex-col gap-3">
      {q.options.map((o, i) => {
        const on = value?.kind === "single" && value.optionId === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange({ kind: "single", optionId: o.id })}
            className={cx(
              "px-tile flex min-h-14 items-stretch gap-3.5 p-2 pr-4 text-left leading-relaxed transition-[background-color,border-color,transform] active:translate-y-0.5",
              on ? "border-accent bg-accent-soft" : "bg-white hover:bg-sun-soft",
            )}
          >
            <span
              className={cx(
                "grid w-10 shrink-0 place-items-center border-2 font-display text-[24px] font-bold leading-none transition-colors",
                on ? "border-accent bg-accent text-white" : "border-ink bg-paper text-ink",
              )}
              aria-hidden
            >
              {LETTERS[i]}
            </span>
            <span className={cx("flex-1 self-center py-1.5", on ? "font-semibold text-ink" : "text-ink")}>{o.content}</span>
            {on && <Check className="h-5 w-5 shrink-0 self-center text-accent" strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

function Timer({ ms }: { ms: number }) {
  const warn = ms < 5 * 60_000;
  const danger = ms < 60_000;
  return (
    <span
      className={cx(
        "flex h-9 items-center gap-2 border-2 px-2.5 font-mono text-lg font-semibold tabular-nums",
        danger ? "animate-pulse border-danger bg-danger text-white" : warn ? "border-ink bg-sun text-ink" : "border-ink bg-paper text-ink",
      )}
    >
      <Clock className="h-4 w-4" strokeWidth={2} aria-hidden />
      <span className="sr-only">Thời gian còn lại </span>
      {fmtClock(ms)}
      {/* Chỉ đọc thông báo khi qua mốc 5 phút và 1 phút */}
      <span className="sr-only" aria-live="assertive">
        {danger ? "Còn dưới 1 phút" : warn ? "Còn dưới 5 phút" : ""}
      </span>
    </span>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span aria-live="polite" className={cx("flex items-center gap-1 text-[13px]", status === "error" ? "text-danger" : status === "saving" ? "text-muted" : "text-ok")}>
      {status === "saving" && "Đang lưu…"}
      {status === "saved" && (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden /> Đã lưu
        </>
      )}
      {status === "error" && "Chưa lưu được, đang thử lại"}
    </span>
  );
}

function SubmitReview({
  total,
  answered,
  unanswered,
  flagged,
  submitting,
  onJump,
  onBack,
  onSubmit,
}: {
  total: number;
  answered: number;
  unanswered: number[];
  flagged: number[];
  submitting: boolean;
  onJump: (i: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col pt-6">
      <h2 className="font-display text-[38px] font-bold leading-none text-ink">Xem lại trước khi nộp</h2>
      <p className="mt-2 text-[15px] text-muted">Bấm vào số câu để quay lại sửa.</p>

      <div className="px-card mt-6 grid grid-cols-3 divide-x-2 divide-ink">
        <ReviewStat label="Đã trả lời" value={answered} />
        <ReviewStat label="Chưa trả lời" value={unanswered.length} strong={unanswered.length > 0} />
        <ReviewStat label="Đánh dấu" value={flagged.length} />
      </div>

      {unanswered.length > 0 && <JumpList title="Câu chưa trả lời" items={unanswered} onJump={onJump} kind="empty" />}
      {flagged.length > 0 && <JumpList title="Câu đã đánh dấu xem lại" items={flagged} onJump={onJump} kind="flag" />}
      {unanswered.length === 0 && (
        <Alert tone="success" className="mt-5">
          Đồng chí đã trả lời đủ {total}/{total} câu.
        </Alert>
      )}

      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-2 border-t-[3px] border-ink bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3.5 sm:-mx-6 sm:px-6">
        <Button size="lg" className="w-full" disabled={submitting} onClick={onSubmit}>
          {submitting ? "Đang nộp bài…" : "Nộp bài"}
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={onBack}>
          Quay lại làm bài
        </Button>
      </div>
    </div>
  );
}

function ReviewStat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="px-4 py-4">
      <p className={cx("font-display text-[48px] font-bold leading-none tabular-nums", strong ? "text-warn" : "text-ink")}>{value}</p>
      <p className={cx("mt-1 font-display text-[17px] font-semibold tracking-[0.04em]", strong ? "text-warn" : "text-muted")}>{label}</p>
    </div>
  );
}

function JumpList({ title, items, onJump, kind }: { title: string; items: number[]; onJump: (i: number) => void; kind: "empty" | "flag" }) {
  return (
    <section className="mt-6">
      <h3 className="font-display text-[22px] font-bold text-ink">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((i) => (
          <button
            key={i}
            onClick={() => onJump(i)}
            className={cx(
              "relative h-12 min-w-12 border-2 px-3 font-display text-[24px] font-bold tabular-nums text-ink transition-colors",
              kind === "empty" ? "border-dashed border-ink/50 bg-white hover:border-solid hover:border-ink" : "border-ink bg-sun-soft hover:bg-sun",
            )}
          >
            {i + 1}
            {kind === "flag" && <span className="absolute right-0.5 top-0.5 h-2 w-2 bg-sun outline-2 outline-ink" aria-hidden />}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Câu đánh dấu lưu trong sessionStorage theo phiên, giữ được khi tải lại trang. */
function useFlags(sessionId: string): [Set<string>, (fn: (s: Set<string>) => Set<string>) => void] {
  const key = `examqr.flags.${sessionId}`;
  const [flags, setFlagsState] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) setFlagsState(new Set(JSON.parse(raw) as string[]));
    } catch {}
  }, [key]);
  const update = (fn: (s: Set<string>) => Set<string>) =>
    setFlagsState((s) => {
      const n = fn(s);
      try {
        sessionStorage.setItem(key, JSON.stringify([...n]));
      } catch {}
      return n;
    });
  return [flags, update];
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
