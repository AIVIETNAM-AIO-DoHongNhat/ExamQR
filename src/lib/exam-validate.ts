export type ExamDraft = {
  title: string;
  durationMin: number;
  questions: {
    content: string;
    points: number;
    options: { content: string; isCorrect: boolean }[];
  }[];
};

/** Danh sách lỗi khiến đề chưa thể dùng để mở phòng. Rỗng = hợp lệ. */
export function examProblems(d: ExamDraft): string[] {
  const out: string[] = [];
  if (d.questions.length === 0) out.push("Đề chưa có câu hỏi nào");
  d.questions.forEach((q, i) => {
    const n = i + 1;
    if (!q.content.trim()) out.push(`Câu ${n}: chưa có nội dung`);
    if (q.options.length < 2) out.push(`Câu ${n}: cần ít nhất 2 đáp án`);
    if (q.options.some((o) => !o.content.trim())) out.push(`Câu ${n}: có đáp án để trống`);
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (correct !== 1) out.push(`Câu ${n}: cần đúng một đáp án đúng`);
  });
  return out;
}
