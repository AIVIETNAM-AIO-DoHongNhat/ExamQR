export type ScoreQuestion = { id: string; points: number };
export type ScoreAnswer = { questionId: string; isCorrect: boolean };

/** Điểm thang 10, làm tròn 2 chữ số. Câu không trả lời tính 0. */
export function computeScore(questions: ScoreQuestion[], answers: ScoreAnswer[]) {
  const total = questions.reduce((s, q) => s + q.points, 0);
  if (total <= 0) return { score: 0, correct: 0 };
  const correctIds = new Set(answers.filter((a) => a.isCorrect).map((a) => a.questionId));
  let earned = 0;
  let correct = 0;
  for (const q of questions) {
    if (correctIds.has(q.id)) {
      earned += q.points;
      correct++;
    }
  }
  return { score: Math.round((earned / total) * 1000) / 100, correct };
}
