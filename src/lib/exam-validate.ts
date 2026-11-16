import { TF_STATEMENTS, type QuestionType } from "./question-types";

export type ExamDraft = {
  title: string;
  durationMin: number;
  questions: {
    type: QuestionType;
    content: string;
    points: number;
    options: { content: string; isCorrect: boolean }[];
  }[];
};

/** Lỗi của một câu (n: số thứ tự hiển thị). */
export function questionProblems(q: ExamDraft["questions"][number], n: number): string[] {
  const out: string[] = [];
  if (!q.content.trim()) out.push(`Câu ${n}: chưa có nội dung`);
  if (q.type === "SINGLE") {
    if (q.options.length < 2) out.push(`Câu ${n}: cần ít nhất 2 đáp án`);
    if (q.options.some((o) => !o.content.trim())) out.push(`Câu ${n}: có đáp án để trống`);
    if (q.options.filter((o) => o.isCorrect).length !== 1) out.push(`Câu ${n}: cần đúng một đáp án đúng`);
  } else if (q.type === "TRUE_FALSE") {
    if (q.options.length !== TF_STATEMENTS) out.push(`Câu ${n}: cần đủ ${TF_STATEMENTS} nhận định`);
    if (q.options.some((o) => !o.content.trim())) out.push(`Câu ${n}: có nhận định để trống`);
  } else {
    if (!q.options.some((o) => o.content.trim())) out.push(`Câu ${n}: cần ít nhất một đáp án được chấp nhận`);
  }
  return out;
}

/** Danh sách lỗi khiến đề chưa thể dùng để mở phòng. Rỗng = hợp lệ. */
export function examProblems(d: ExamDraft): string[] {
  if (d.questions.length === 0) return ["Đề chưa có câu hỏi nào"];
  return d.questions.flatMap((q, i) => questionProblems(q, i + 1));
}
