"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteExam, duplicateExam, saveExam } from "@/server/teacher-actions";
import { examProblems, type ExamDraft } from "@/lib/exam-validate";
import { Alert, Badge, Button, Card, EmptyState, Input, Label, Textarea, cx, PixelRule } from "@/components/ui";
import { useConfirm } from "@/components/Dialog";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Plus, Trash2, X } from "@/components/icons";

type Q = ExamDraft["questions"][number] & { key: string };
let keySeq = 0;
const k = () => `k${++keySeq}`;
const LETTERS = "ABCDEF";

const blankQuestion = (): Q => ({
  key: k(),
  content: "",
  points: 1,
  options: [
    { content: "", isCorrect: true },
    { content: "", isCorrect: false },
    { content: "", isCorrect: false },
    { content: "", isCorrect: false },
  ],
});

export function ExamEditor({
  examId,
  initial,
  locked,
  showCheck,
}: {
  examId: string;
  initial: ExamDraft;
  locked: boolean;
  showCheck: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [durationMin, setDuration] = useState(initial.durationMin);
  const [questions, setQuestions] = useState<Q[]>(() => initial.questions.map((q) => ({ ...q, key: k() })));
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const first = useRef(true);
  const [ask, dialog] = useConfirm();

  const draft: ExamDraft = useMemo(
    () => ({ title, durationMin, questions: questions.map(({ content, points, options }) => ({ content, points, options })) }),
    [title, durationMin, questions],
  );
  const problems = useMemo(() => examProblems(draft), [draft]);

  // Tự lưu sau 1,2 giây không gõ
  useEffect(() => {
    if (locked) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("dirty");
    const timer = setTimeout(async () => {
      setStatus("saving");
      const res = await saveExam(examId, draft);
      if (res.ok) {
        setStatus("saved");
        setError(null);
      } else {
        setStatus("error");
        setError(res.error);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [draft, examId, locked]);

  // Cảnh báo khi rời trang lúc chưa lưu
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (status === "dirty" || status === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [status]);

  const updateQ = (i: number, patch: Partial<Q>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const j = i + d;
      if (j < 0 || j >= qs.length) return qs;
      const out = qs.slice();
      [out[i], out[j]] = [out[j], out[i]];
      setSelected(j);
      return out;
    });

  const q = questions[selected];

  return (
    <div className="flex flex-col gap-6">
      {dialog}
      <div className="flex flex-col gap-3">
        <Link href="/dashboard?tab=exams" className="inline-flex w-fit items-center gap-1.5 font-display text-[18px] font-semibold tracking-[0.04em] text-muted transition-colors hover:text-accent">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Danh sách đề
        </Link>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[44px] font-bold leading-[0.95] text-ink sm:text-[52px]">{title || "Đề chưa đặt tên"}</h1>
          <PixelRule className="mt-3" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          {locked ? (
            <Badge tone="gold">Đề đã dùng, chỉ xem</Badge>
          ) : (
            <span
              aria-live="polite"
              className={cx("mr-2 flex items-center gap-1 text-[13px]", status === "error" ? "font-medium text-danger" : status === "saved" ? "text-ok" : "text-muted")}
            >
              {status === "saved" && (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden /> Đã lưu
                </>
              )}
              {status === "dirty" && "Có thay đổi…"}
              {status === "saving" && "Đang lưu…"}
              {status === "error" && (
                <>
                  <AlertTriangle className="h-4 w-4" aria-hidden /> {error ?? "Lỗi khi lưu"}
                </>
              )}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={() => startTransition(() => duplicateExam(examId))}>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Nhân bản
          </Button>
          {!locked && (
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                const ok = await ask({
                  title: "Xóa đề này?",
                  message: (
                    <p>
                      Đề “{title}” và toàn bộ {questions.length} câu hỏi sẽ bị xóa, không khôi phục được.
                    </p>
                  ),
                  confirmLabel: "Xóa đề",
                  tone: "danger",
                });
                if (ok)
                  startTransition(async () => {
                    await deleteExam(examId);
                    window.location.href = "/dashboard";
                  });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Xóa đề
            </Button>
          )}
        </div>
      </div>
      </div>
      {locked && (
        <Alert tone="info">Đề đã dùng cho buổi kiểm tra nên bị khóa để giữ đúng kết quả. Muốn sửa, bấm “Nhân bản” để tạo bản sao.</Alert>
      )}

      <Card className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <label>
          <Label>Tên đề</Label>
          <Input value={title} disabled={locked} onChange={(e) => setTitle(e.target.value)} className="font-semibold" />
        </label>
        <label>
          <Label>Thời gian (phút)</Label>
          <Input
            type="number"
            min={1}
            max={180}
            value={durationMin}
            disabled={locked}
            onChange={(e) => setDuration(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
          />
        </label>
      </Card>

      {(showCheck || problems.length > 0) && problems.length > 0 && (
        <Alert tone="warn">
          <p className="mb-1 font-medium">Đề chưa sẵn sàng để mở phòng:</p>
          <ul className="list-inside list-disc text-ink-soft">
            {problems.slice(0, 8).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {problems.length > 8 && <li>… và {problems.length - 8} lỗi khác</li>}
          </ul>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[240px_1fr_280px]">
        {/* Danh sách câu */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-1">
            <p className="font-display text-[24px] font-bold leading-none text-ink">Câu hỏi</p>
            <p className="text-[13px] tabular-nums text-muted">
              {questions.length} câu · {questions.reduce((s, x) => s + x.points, 0)} điểm
            </p>
          </div>
          <div className="px-card m-1 flex max-h-[62vh] flex-col overflow-y-auto">
            {questions.map((qq, i) => {
              const bad = examProblems({ title, durationMin, questions: [qq] }).length > 0;
              return (
                <button
                  key={qq.key}
                  onClick={() => setSelected(i)}
                  className={cx(
                    "flex min-h-11 items-center gap-3 border-b-2 border-ink/10 px-3 py-2 text-left text-sm transition-colors last:border-b-0",
                    i === selected ? "bg-accent text-white" : "text-ink-soft hover:bg-sun-soft",
                  )}
                >
                  <span className={cx("w-6 shrink-0 text-right font-display text-[22px] font-bold leading-none tabular-nums", i === selected ? "text-sun" : "text-muted")}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{qq.content || <em className="not-italic opacity-60">Chưa có nội dung</em>}</span>
                  {bad && <span className="h-2.5 w-2.5 shrink-0 border-2 border-ink bg-sun" title="Câu chưa hoàn chỉnh" aria-label="Chưa hoàn chỉnh" />}
                </button>
              );
            })}
          </div>
          {!locked && (
            <Button
              variant="secondary"
              onClick={() => {
                setQuestions((qs) => [...qs, blankQuestion()]);
                setSelected(questions.length);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Thêm câu
            </Button>
          )}
          <p className="px-1 text-[13px] text-muted">Điểm quy về thang 10.</p>
        </div>

        {/* Soạn câu đang chọn */}
        {q ? (
          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-baseline gap-2 font-display text-ink">
                <span className="text-[26px] font-bold text-muted">Câu</span>
                <span className="text-[52px] font-extrabold leading-none text-accent [text-shadow:3px_3px_0_var(--color-sun)]">{selected + 1}</span>
              </h2>
              {!locked && (
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => move(selected, -1)} disabled={selected === 0} aria-label="Chuyển câu lên trên" title="Chuyển lên">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => move(selected, 1)}
                    disabled={selected === questions.length - 1}
                    aria-label="Chuyển câu xuống dưới"
                    title="Chuyển xuống"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <span className="mx-1 h-6 w-0.5 bg-ink/20" aria-hidden />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft hover:text-danger"
                    onClick={async () => {
                      const idx = selected;
                      if (questions[idx]?.content.trim()) {
                        const ok = await ask({
                          title: `Xóa câu ${idx + 1}?`,
                          message: <p>Nội dung câu hỏi và các đáp án sẽ bị xóa.</p>,
                          confirmLabel: "Xóa câu",
                          tone: "danger",
                        });
                        if (!ok) return;
                      }
                      setQuestions((qs) => qs.filter((_, j) => j !== idx));
                      setSelected((x) => Math.max(0, x - 1));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Xóa câu
                  </Button>
                </div>
              )}
            </div>
            <label>
              <Label>Nội dung câu hỏi</Label>
              <Textarea rows={3} value={q.content} disabled={locked} onChange={(e) => updateQ(selected, { content: e.target.value })} />
            </label>
            <div>
              <Label>Đáp án · chọn ô tròn ở đáp án đúng</Label>
              <div className="flex flex-col gap-2">
                {q.options.map((o, oi) => (
                  <div
                    key={oi}
                    className={cx(
                      "px-tile flex items-center gap-3 pl-3 transition-colors",
                      o.isCorrect ? "border-ok bg-mint-soft" : "bg-white focus-within:border-accent",
                    )}
                  >
                    <input
                      type="radio"
                      name={`correct-${q.key}`}
                      checked={o.isCorrect}
                      disabled={locked}
                      onChange={() => updateQ(selected, { options: q.options.map((x, j) => ({ ...x, isCorrect: j === oi })) })}
                      className="h-4 w-4 shrink-0 accent-ok"
                      aria-label={`Đáp án ${LETTERS[oi]} đúng`}
                    />
                    <span className={cx("grid h-7 w-7 shrink-0 place-items-center border-2 font-display text-[19px] font-bold leading-none", o.isCorrect ? "border-ink bg-mint text-ink" : "border-ink/40 text-muted")}>{LETTERS[oi]}</span>
                    <input
                      value={o.content}
                      disabled={locked}
                      placeholder={`Nội dung đáp án ${LETTERS[oi]}`}
                      onChange={(e) =>
                        updateQ(selected, { options: q.options.map((x, j) => (j === oi ? { ...x, content: e.target.value } : x)) })
                      }
                      className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/60"
                    />
                    {o.isCorrect && <span className="shrink-0 border-2 border-ok bg-white px-1.5 font-display text-[16px] font-bold text-ok">ĐÚNG</span>}
                    {!locked && q.options.length > 2 ? (
                      <button
                        type="button"
                        className="grid h-10 w-10 shrink-0 place-items-center text-muted transition-colors hover:text-danger"
                        aria-label={`Xóa đáp án ${LETTERS[oi]}`}
                        onClick={() => {
                          const opts = q.options.filter((_, j) => j !== oi);
                          if (!opts.some((x) => x.isCorrect)) opts[0] = { ...opts[0], isCorrect: true };
                          updateQ(selected, { options: opts });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
              {!locked && q.options.length < 6 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="-ml-2 mt-2"
                  onClick={() => updateQ(selected, { options: [...q.options, { content: "", isCorrect: false }] })}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Thêm đáp án
                </Button>
              )}
            </div>
            <label className="w-32">
              <Label>Điểm</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={q.points}
                disabled={locked}
                onChange={(e) => updateQ(selected, { points: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
              />
            </label>
          </Card>
        ) : (
          <EmptyState title="Chưa có câu hỏi">Bấm “Thêm câu” để bắt đầu soạn.</EmptyState>
        )}

        {/* Xem trước trên điện thoại */}
        <div className="hidden lg:block">
          <p className="mb-3 px-1 font-display text-[22px] font-bold leading-none text-ink">Xem trước trên điện thoại</p>
          <div className="mx-auto w-[248px] overflow-hidden border-[6px] border-ink bg-paper shadow-[6px_6px_0_0_var(--color-accent)]">
            <div className="flex items-center gap-2 bg-ink-deep px-3 py-2.5">
              <span className="h-3 w-3 shrink-0 border border-sun" />
              <span className="truncate font-display text-[14px] font-bold text-on-dark">{title || "Tên đề"}</span>
            </div>
            {q ? (
              <div className="flex flex-col p-3.5">
                <p className="w-fit border border-ink bg-sun px-1 font-display text-[11px] font-bold text-ink">
                  Câu {selected + 1} / {questions.length}
                </p>
                <p className="mt-1.5 border-2 border-ink bg-white px-2 py-1.5 text-[11px] font-semibold leading-snug text-ink">{q.content || "…"}</p>
                <div className="mt-3 flex flex-col gap-1.5">
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-start gap-2 border border-b-2 border-ink bg-white px-1.5 py-1 text-[10px] leading-snug text-ink">
                      <span className="grid h-3.5 w-3.5 shrink-0 place-items-center border border-ink bg-paper font-display text-[10px] font-bold leading-none">{LETTERS[oi]}</span>
                      <span>
                        {o.content || "…"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-center font-display text-[12px] font-bold">
                  <div className="border border-b-2 border-ink bg-white py-1 text-ink">Câu trước</div>
                  <div className="border border-b-2 border-ink bg-accent py-1 text-white">Câu sau</div>
                </div>
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-center text-[13px] leading-relaxed text-muted">Thứ tự câu và đáp án được đảo riêng cho từng học viên.</p>
        </div>
      </div>
    </div>
  );
}
