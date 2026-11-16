import { compareSbd } from "./sbd";
import { creditOf, normalizeShort, type QuestionType } from "./question-types";

/** Ngưỡng đạt và ngưỡng biểu dương trên thang 10. */
export const PASS_SCORE = 5;
export const HONOR_SCORE = 9;

type QInput = { id: string; type: QuestionType; content: string; options: { id: string; content: string; isCorrect: boolean }[] };
type AInput = { questionId: string; optionId: string | null; isCorrect: boolean; credit: number | null; text?: string | null; marks?: unknown };

/**
 * Thống kê từng câu (theo thứ tự đề gốc). rate = điểm trung bình của câu (0..1) trên số người trả lời.
 * - SINGLE: picked = số người chọn phương án.
 * - TRUE_FALSE: picked = số người đánh đúng nhận định đó.
 * - SHORT: responses = các câu trả lời khác nhau (gộp theo nội dung chuẩn hóa), nhiều nhất trước.
 */
export function questionStats(questions: QInput[], answers: AInput[]) {
  const byQ = new Map<string, AInput[]>();
  for (const a of answers) {
    const list = byQ.get(a.questionId);
    if (list) list.push(a);
    else byQ.set(a.questionId, [a]);
  }
  return questions.map((q, i) => {
    const list = byQ.get(q.id) ?? [];
    const credits = list.map(creditOf);
    const picked = (o: QInput["options"][number]) =>
      q.type === "TRUE_FALSE"
        ? list.filter((a) => ((a.marks ?? {}) as Record<string, boolean>)[o.id] === o.isCorrect).length
        : q.type === "SINGLE"
          ? list.filter((a) => a.optionId === o.id).length
          : 0;
    return {
      index: i + 1,
      id: q.id,
      type: q.type,
      content: q.content,
      answered: list.length,
      correct: credits.filter((c) => c >= 1).length,
      rate: list.length ? credits.reduce((a, b) => a + b, 0) / list.length : null,
      options: q.options.map((o) => ({ content: o.content, isCorrect: o.isCorrect, picked: picked(o) })),
      responses: q.type === "SHORT" ? groupResponses(list) : [],
    };
  });
}

function groupResponses(list: AInput[]) {
  const groups = new Map<string, { text: string; normalized: string; count: number; accepted: boolean }>();
  for (const a of list) {
    const normalized = normalizeShort(a.text ?? "");
    if (!normalized) continue;
    const g = groups.get(normalized);
    if (g) g.count++;
    else groups.set(normalized, { text: (a.text ?? "").trim(), normalized, count: 1, accepted: creditOf(a) >= 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, "vi"));
}

/** Các câu có tỉ lệ đúng thấp nhất (bỏ qua câu chưa ai trả lời). */
export function hardestQuestions<T extends { rate: number | null }>(qs: T[], n = 3) {
  return qs
    .filter((q): q is T & { rate: number } => q.rate != null)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, n);
}

/** Thống kê điểm: trung bình, cao, thấp, tỉ lệ đạt, phổ điểm 10 nhóm [0,1) … [9,10]. */
export function scoreSummary(scores: number[]) {
  const bins = Array.from({ length: 10 }, () => 0);
  scores.forEach((s) => (bins[Math.max(0, Math.min(9, Math.floor(s)))] += 1));
  const n = scores.length;
  return {
    count: n,
    avg: n ? scores.reduce((a, b) => a + b, 0) / n : null,
    max: n ? Math.max(...scores) : null,
    min: n ? Math.min(...scores) : null,
    passRate: n ? scores.filter((s) => s >= PASS_SCORE).length / n : null,
    bins,
  };
}

/**
 * Danh sách biểu dương: các SBD đạt từ HONOR_SCORE, xếp theo SBD (không xếp hạng).
 * Không ai đạt thì lấy nhóm điểm cao nhất, miễn là từ ngưỡng đạt trở lên.
 */
export function honorRoll(people: { sbd: string; score: number | null }[], limit = 12) {
  const scored = people.filter((p): p is { sbd: string; score: number } => p.score != null);
  let list = scored.filter((p) => p.score >= HONOR_SCORE);
  let kind: "honor" | "top" | "none" = "honor";
  if (!list.length) {
    const max = Math.max(-1, ...scored.map((p) => p.score));
    list = max >= PASS_SCORE ? scored.filter((p) => p.score === max) : [];
    kind = list.length ? "top" : "none";
  }
  const sorted = [...list].sort((a, b) => compareSbd(a.sbd, b.sbd));
  return { kind, items: sorted.slice(0, limit), more: Math.max(0, sorted.length - limit) };
}
