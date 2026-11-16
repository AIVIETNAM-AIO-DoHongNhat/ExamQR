"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAnswer, submitExam } from "@/server/play-actions";
import type { AnswerResult, PlayState } from "@/lib/play-types";
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
  save: (code: string, questionId: string, optionId: string) => Promise<AnswerResult>;
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
    const first = qs.findIndex((q) => !state.chosen[q.id]);
    return first === -1 ? 0 : first;
  });
  const [chosen, setChosen] = useState<Record<string, string>>(state.chosen);
  const [flags, setFlags] = useFlags(state.sessionId);
  const [view, setView] = useState<"question" | "review">(initialView);
  const [navOpen, setNavOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  const [ask, dialog] = useConfirm();

  /* ---------- Hàng đợi lưu đáp án: gửi lần lượt, mất mạng thì thử lại ---------- */
  const queue = useRef(new Map<string, string>());
  const inflight = useRef<Promise<boolean> | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const run = useCallback(async (): Promise<boolean> => {
    setSaveStatus("saving");
    try {
      while (queue.current.size) {
        const [qid, oid] = queue.current.entries().next().value as [string, string];
        const r = await api.save(state.code, qid, oid);
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
        if (queue.current.get(qid) === oid) queue.current.delete(qid);
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

  const choose = (qid: string, oid: string) => {
    if (timeUp || submitting) return;
    setChosen((c) => ({ ...c, [qid]: oid }));
    queue.current.set(qid, oid);
    void flush();
  };

  const answeredCount = qs.filter((q) => chosen[q.id]).length;
  const unanswered = qs.map((q, i) => (chosen[q.id] ? -1 : i)).filter((i) => i >= 0);
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
  const qSave: SaveStatus = chosen[q.id] ? (queue.current.has(q.id) ? (saveStatus === "error" ? "error" : "saving") : "saved") : "idle";

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
              <div role="radiogroup" aria-labelledby={`q-${q.id}`} className="mt-7 flex flex-col gap-3">
                {q.options.map((o, i) => {
                  const on = chosen[q.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      role="radio"
                      aria-checked={on}
                      onClick={() => choose(q.id, o.id)}
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
            </motion.section>
          </AnimatePresence>

          <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t-[3px] border-ink bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3.5 sm:-mx-6 sm:px-6">
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" className="flex-1 px-3" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Câu trước
              </Button>
              {isLast ? (
                <Button size="lg" className="flex-1 px-3" onClick={() => setView("review")}>
                  Xem lại và nộp
                </Button>
              ) : (
                <Button size="lg" className="flex-1 px-3" onClick={() => setIndex((i) => i + 1)}>
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
        isAnswered={(i) => !!chosen[qs[i].id]}
        isFlagged={(i) => flags.has(qs[i].id)}
        onPick={(i) => {
          setIndex(i);
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
