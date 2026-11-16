"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteExam, duplicateExam, saveExam } from "@/server/teacher-actions";
import { examProblems, questionProblems, type ExamDraft } from "@/lib/exam-validate";
import { QUESTION_TYPES, STATEMENT_LABELS, TF_LADDER, TF_STATEMENTS, TYPE_LABEL, type QuestionType } from "@/lib/question-types";
import { Alert, Badge, Button, Card, EmptyState, Input, Label, Textarea, cx, PixelRule } from "@/components/ui";
import { useConfirm } from "@/components/Dialog";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Plus, Trash2, X } from "@/components/icons";

type Q = ExamDraft["questions"][number] & { key: string };
let keySeq = 0;
const k = () => `k${++keySeq}`;
const LETTERS = "ABCDEF";

type Opt = Q["options"][number];
const blankOptions = (type: QuestionType): Opt[] =>
  type === "SINGLE"
    ? [0, 1, 2, 3].map((i) => ({ content: "", isCorrect: i === 0 }))
    : type === "TRUE_FALSE"
      ? Array.from({ length: TF_STATEMENTS }, () => ({ content: "", isCorrect: true }))
      : [{ content: "", isCorrect: true }];

const blankQuestion = (type: QuestionType): Q => ({ key: k(), type, content: "", points: type === "TRUE_FALSE" ? 2 : 1, options: blankOptions(type) });

/** Đổi dạng câu, giữ lại nội dung đã gõ khi có thể. */
function convertOptions(q: Q, to: QuestionType): Opt[] {
  const texts = q.options.map((o) => o.content);
  if (to === "SINGLE") {
    const n = Math.max(2, Math.min(6, texts.length));
    return Array.from({ length: n }, (_, i) => ({ content: q.type === "SHORT" ? (i === 0 ? texts[0] ?? "" : "") : texts[i] ?? "", isCorrect: i === 0 }));
  }
  if (to === "TRUE_FALSE") {
    if (q.type === "SHORT") return blankOptions(to);
    return Array.from({ length: TF_STATEMENTS }, (_, i) => ({ content: texts[i] ?? "", isCorrect: true }));
  }
  const right = q.type === "SINGLE" ? q.options.find((o) => o.isCorrect)?.content : undefined;
  return [{ content: right ?? "", isCorrect: true }];
}

const TYPE_TAG: Record<QuestionType, string> = { SINGLE: "TN", TRUE_FALSE: "Đ/S", SHORT: "TL" };

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
    () => ({ title, durationMin, questions: questions.map(({ type, content, points, options }) => ({ type, content, points, options })) }),
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
              const bad = questionProblems(qq, i + 1).length > 0;
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
                  {qq.type !== "SINGLE" && (
                    <span className={cx("shrink-0 border px-1 font-display text-[13px] font-bold leading-tight", i === selected ? "border-white/60 text-white" : "border-ink/30 text-muted")}>
                      {TYPE_TAG[qq.type]}
                    </span>
                  )}
                  {bad && <span className="h-2.5 w-2.5 shrink-0 border-2 border-ink bg-sun" title="Câu chưa hoàn chỉnh" aria-label="Chưa hoàn chỉnh" />}
                </button>
              );
            })}
          </div>
          {!locked && (
            <div className="flex flex-col gap-1.5">
              <p className="px-1 font-display text-[17px] font-semibold tracking-[0.04em] text-muted">Thêm câu</p>
              {QUESTION_TYPES.map((t) => (
                <Button
                  key={t}
                  variant="secondary"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    // Chèn sau câu cuối cùng cùng dạng để các phần của đề không lẫn vào nhau.
                    const at = questions.reduce((last, x, i) => (x.type === t ? i + 1 : last), questions.length);
                    setQuestions((qs) => [...qs.slice(0, at), blankQuestion(t), ...qs.slice(at)]);
                    setSelected(at);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {TYPE_LABEL[t]}
                </Button>
              ))}
            </div>
          )}
          <p className="px-1 text-[13px] text-muted">Điểm quy về thang 10. Học viên làm lần lượt từng phần theo thứ tự các dạng trong đề.</p>
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
            <div>
              <Label>Dạng câu</Label>
              <div className="flex w-fit max-w-full flex-wrap border-2 border-ink bg-white" role="radiogroup" aria-label="Dạng câu">
                {QUESTION_TYPES.map((t, ti) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={q.type === t}
                    disabled={locked}
                    onClick={() => q.type !== t && updateQ(selected, { type: t, options: convertOptions(q, t) })}
                    className={cx(
                      "px-3 py-1 font-display text-[18px] font-semibold tracking-[0.04em] transition-colors disabled:cursor-not-allowed",
                      ti > 0 && "border-l-2 border-ink",
                      q.type === t ? "bg-accent text-white" : "text-ink-soft enabled:hover:bg-accent-soft",
                    )}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <label>
              <Label>{q.type === "TRUE_FALSE" ? "Câu dẫn (chủ đề chung của 4 nhận định)" : "Nội dung câu hỏi"}</Label>
              <Textarea rows={3} value={q.content} disabled={locked} onChange={(e) => updateQ(selected, { content: e.target.value })} />
            </label>
            <OptionsEditor q={q} locked={locked} onChange={(options) => updateQ(selected, { options })} />
            <label className="w-32">
              <Label>{q.type === "TRUE_FALSE" ? "Điểm cả câu" : "Điểm"}</Label>
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
                <PhonePreview q={q} />
                <div className="mt-3 grid grid-cols-2 gap-1.5 text-center font-display text-[12px] font-bold">
                  <div className="border border-b-2 border-ink bg-white py-1 text-ink">Câu trước</div>
                  <div className="border border-b-2 border-ink bg-accent py-1 text-white">Câu sau</div>
                </div>
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-center text-[13px] leading-relaxed text-muted">Thứ tự câu trong mỗi phần và thứ tự phương án trắc nghiệm được đảo riêng cho từng học viên.</p>
        </div>
      </div>
    </div>
  );
}

function OptionsEditor({ q, locked, onChange }: { q: Q; locked: boolean; onChange: (o: Opt[]) => void }) {
  const set = (i: number, patch: Partial<Opt>) => onChange(q.options.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  if (q.type === "TRUE_FALSE") {
    return (
      <div>
        <Label>Nhận định · bấm Đúng/Sai để đặt đáp án</Label>
        <div className="flex flex-col gap-2">
          {q.options.map((o, oi) => (
            <div key={oi} className="px-tile flex items-center gap-3 bg-white pl-3 focus-within:border-accent">
              <span className="w-5 shrink-0 font-display text-[22px] font-bold leading-none text-accent">{STATEMENT_LABELS[oi]})</span>
              <textarea
                rows={2}
                value={o.content}
                disabled={locked}
                placeholder={`Nhận định ${STATEMENT_LABELS[oi]}`}
                onChange={(e) => set(oi, { content: e.target.value })}
                className="min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] leading-snug text-ink outline-none placeholder:text-muted/60"
              />
              <div className="flex shrink-0 self-stretch border-l-2 border-ink/15">
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={locked}
                    aria-pressed={o.isCorrect === v}
                    onClick={() => set(oi, { isCorrect: v })}
                    className={cx(
                      "w-14 font-display text-[18px] font-bold transition-colors disabled:cursor-not-allowed",
                      o.isCorrect === v ? (v ? "bg-mint text-ink" : "bg-danger text-white") : "text-muted enabled:hover:bg-paper",
                    )}
                  >
                    {v ? "Đúng" : "Sai"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Chấm theo số nhận định đúng: 1 ý được {TF_LADDER[1] * 100}%, 2 ý {TF_LADDER[2] * 100}%, 3 ý {TF_LADDER[3] * 100}%, đủ 4 ý được trọn điểm câu.
        </p>
      </div>
    );
  }

  if (q.type === "SHORT") {
    return (
      <div>
        <Label>Đáp án được chấp nhận · mỗi dòng một cách viết</Label>
        <div className="flex flex-col gap-2">
          {q.options.map((o, oi) => (
            <div key={oi} className="px-tile flex items-center gap-3 border-ok bg-mint-soft pl-3">
              <Check className="h-4 w-4 shrink-0 text-ok" strokeWidth={3} aria-hidden />
              <input
                value={o.content}
                disabled={locked}
                placeholder={oi === 0 ? "Đáp án chuẩn" : "Cách viết khác cũng chấp nhận"}
                onChange={(e) => set(oi, { content: e.target.value })}
                className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/60"
              />
              {!locked && q.options.length > 1 ? (
                <button
                  type="button"
                  className="grid h-10 w-10 shrink-0 place-items-center text-muted transition-colors hover:text-danger"
                  aria-label="Xóa cách viết này"
                  onClick={() => onChange(q.options.filter((_, j) => j !== oi))}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <span className="w-3 shrink-0" />
              )}
            </div>
          ))}
        </div>
        {!locked && q.options.length < 10 && (
          <Button size="sm" variant="ghost" className="-ml-2 mt-2" onClick={() => onChange([...q.options, { content: "", isCorrect: true }])}>
            <Plus className="h-4 w-4" aria-hidden />
            Thêm cách viết khác
          </Button>
        )}
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Tự chấm khi câu trả lời trùng một trong các cách viết trên (không phân biệt chữ hoa/thường, bỏ qua dấu câu). Sau buổi kiểm tra, giảng viên có thể chấm lại từng câu trả lời trong trang báo cáo.
        </p>
      </div>
    );
  }

  return (
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
              onChange={() => onChange(q.options.map((x, j) => ({ ...x, isCorrect: j === oi })))}
              className="h-4 w-4 shrink-0 accent-ok"
              aria-label={`Đáp án ${LETTERS[oi]} đúng`}
            />
            <span className={cx("grid h-7 w-7 shrink-0 place-items-center border-2 font-display text-[19px] font-bold leading-none", o.isCorrect ? "border-ink bg-mint text-ink" : "border-ink/40 text-muted")}>{LETTERS[oi]}</span>
            <input
              value={o.content}
              disabled={locked}
              placeholder={`Nội dung đáp án ${LETTERS[oi]}`}
              onChange={(e) =>
                onChange(q.options.map((x, j) => (j === oi ? { ...x, content: e.target.value } : x)))
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
                  onChange(opts);
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
          onClick={() => onChange([...q.options, { content: "", isCorrect: false }])}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Thêm đáp án
        </Button>
      )}
    </div>
  );
}

function PhonePreview({ q }: { q: Q }) {
  if (q.type === "TRUE_FALSE") {
    return (
      <div className="mt-3 flex flex-col gap-1.5">
        {q.options.map((o, oi) => (
          <div key={oi} className="border border-b-2 border-ink bg-white px-1.5 py-1 text-[10px] leading-snug text-ink">
            <p>
              <b className="text-accent">{STATEMENT_LABELS[oi]})</b> {o.content || "…"}
            </p>
            <div className="mt-1 grid grid-cols-2 gap-1 text-center font-display text-[10px] font-bold">
              <span className="border border-ink/40">Đúng</span>
              <span className="border border-ink/40">Sai</span>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (q.type === "SHORT") {
    return <div className="mt-3 h-14 border border-b-2 border-ink bg-white px-1.5 py-1 text-[10px] text-muted">Gõ câu trả lời ngắn gọn…</div>;
  }
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {q.options.map((o, oi) => (
        <div key={oi} className="flex items-start gap-2 border border-b-2 border-ink bg-white px-1.5 py-1 text-[10px] leading-snug text-ink">
          <span className="grid h-3.5 w-3.5 shrink-0 place-items-center border border-ink bg-paper font-display text-[10px] font-bold leading-none">{LETTERS[oi]}</span>
          <span>{o.content || "…"}</span>
        </div>
      ))}
    </div>
  );
}
