import "server-only";
import { prisma } from "@/lib/prisma";
import { compareSbd } from "@/lib/sbd";
import { questionStats, scoreSummary } from "@/lib/stats";

/** Số liệu báo cáo của một buổi; null nếu không thuộc giảng viên này. */
export async function loadReport(sessionId: string, teacherId: string) {
  const s = await prisma.session.findFirst({
    where: { id: sessionId, exam: { teacherId } },
    include: {
      exam: { include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } } },
      class: { include: { students: true } },
      participants: { include: { student: true, answers: true } },
    },
  });
  if (!s) return null;

  const byStudent = new Map(s.participants.map((p) => [p.studentId, p]));
  const rows = s.class.students
    .map((st) => {
      const p = byStudent.get(st.id);
      return {
        sbd: st.sbd,
        present: !!p,
        answered: p?.answeredCount ?? 0,
        correct: p?.correctCount ?? 0,
        score: p?.score ?? null,
        joinedAt: p?.joinedAt ?? null,
        finishedAt: p?.finishedAt ?? null,
        durationSec: p?.finishedAt && s.startedAt ? Math.max(0, Math.round((p.finishedAt.getTime() - s.startedAt.getTime()) / 1000)) : null,
      };
    })
    .sort((a, b) => compareSbd(a.sbd, b.sbd));

  const questions = questionStats(
    s.exam.questions,
    s.participants.flatMap((p) => p.answers),
  );

  const summary = scoreSummary(rows.map((r) => r.score).filter((x): x is number => x != null));
  return {
    session: s,
    rows,
    questions,
    stats: {
      present: s.participants.length,
      total: s.class.students.length,
      ...summary,
    },
  };
}
