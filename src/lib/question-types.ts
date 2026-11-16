/**
 * Ba dạng câu hỏi và cách chấm. Dùng chung cho server (chấm điểm) và trình duyệt (soạn đề, làm bài).
 *
 * Bảng Option được dùng lại cho cả ba dạng:
 * - SINGLE: các phương án, đúng một phương án có isCorrect.
 * - TRUE_FALSE: các nhận định (giữ nguyên thứ tự a, b, c, d); isCorrect = nhận định đó Đúng.
 * - SHORT: các đáp án được chấp nhận (isCorrect luôn true); không bao giờ gửi xuống điện thoại.
 */

export const QUESTION_TYPES = ["SINGLE", "TRUE_FALSE", "SHORT"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE: "Trắc nghiệm",
  TRUE_FALSE: "Đúng/Sai",
  SHORT: "Trả lời ngắn",
};

/** Số nhận định của một câu Đúng/Sai (theo định dạng đề thi mới: 4 ý a, b, c, d). */
export const TF_STATEMENTS = 4;
export const STATEMENT_LABELS = "abcd";
/** Tỉ lệ điểm theo số nhận định trả lời đúng: 0, 1, 2, 3, 4 ý. */
export const TF_LADDER = [0, 0.1, 0.25, 0.5, 1] as const;
export const SHORT_MAX = 200;

/** Câu trả lời của học viên cho một câu. */
export type Response =
  | { kind: "single"; optionId: string }
  | { kind: "tf"; marks: Record<string, boolean> }
  | { kind: "short"; text: string };

/** Học viên đã trả lời đủ câu này chưa (Đúng/Sai: đủ cả 4 ý). */
export function isComplete(r: Response | undefined, statementCount = TF_STATEMENTS): boolean {
  if (!r) return false;
  if (r.kind === "single") return true;
  if (r.kind === "tf") return Object.keys(r.marks).length >= statementCount;
  return r.text.trim().length > 0;
}

/** Chuẩn hóa câu trả lời ngắn để so khớp: chữ thường, bỏ dấu câu và khoảng trắng thừa; giữ dấu tiếng Việt. */
export function normalizeShort(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

type GradeOption = { id: string; content: string; isCorrect: boolean };

/** Tỉ lệ điểm (0..1) của một câu trả lời. */
export function grade(type: QuestionType, options: GradeOption[], r: Response): number {
  if (type === "SINGLE") {
    return r.kind === "single" && options.some((o) => o.id === r.optionId && o.isCorrect) ? 1 : 0;
  }
  if (type === "TRUE_FALSE") {
    if (r.kind !== "tf") return 0;
    const right = options.filter((o) => r.marks[o.id] === o.isCorrect).length;
    if (options.length === TF_STATEMENTS) return TF_LADDER[right];
    return options.length ? right / options.length : 0;
  }
  if (r.kind !== "short") return 0;
  const given = normalizeShort(r.text);
  return given && options.some((o) => normalizeShort(o.content) === given) ? 1 : 0;
}

/** Đọc câu trả lời đã lưu trong bảng Answer. */
export function responseFromRow(type: QuestionType, row: { optionId: string | null; text: string | null; marks: unknown }): Response | null {
  if (type === "SINGLE") return row.optionId ? { kind: "single", optionId: row.optionId } : null;
  if (type === "TRUE_FALSE") return row.marks && typeof row.marks === "object" ? { kind: "tf", marks: row.marks as Record<string, boolean> } : null;
  return row.text != null ? { kind: "short", text: row.text } : null;
}

/** Tỉ lệ điểm của bản ghi Answer; bản ghi cũ (trước khi có cột credit) dùng isCorrect. */
export const creditOf = (a: { credit: number | null; isCorrect: boolean }) => a.credit ?? (a.isCorrect ? 1 : 0);
