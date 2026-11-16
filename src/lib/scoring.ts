export type ScoreQuestion = { id: string; points: number };
/** credit: tỉ lệ điểm đạt được của câu (0..1). */
export type ScoreAnswer = { questionId: string; credit: number };

/**
 * Điểm thang 10, làm tròn 2 chữ số. Câu không trả lời tính 0.
 * `correct` là số câu đúng hoàn toàn (câu Đúng/Sai được điểm một phần không tính).
 */
export function computeScore(questions: ScoreQuestion[], answers: ScoreAnswer[]) {
  const total = questions.reduce((s, q) => s + q.points, 0);
  if (total <= 0) return { score: 0, correct: 0 };
  const credit = new Map(answers.map((a) => [a.questionId, a.credit]));
  let earned = 0;
  let correct = 0;
  for (const q of questions) {
    const c = credit.get(q.id) ?? 0;
    earned += q.points * c;
    if (c >= 1) correct++;
  }
  return { score: Math.round((earned / total) * 1000) / 100, correct };
}
