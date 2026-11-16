import "server-only";
import { prisma } from "@/lib/prisma";
import { computeScore } from "@/lib/scoring";

/** Chấm và chốt điểm một người (idempotent: đã chốt thì trả lại kết quả cũ). */
export async function finalizeParticipant(participantId: string) {
  const p = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    include: {
      answers: { select: { questionId: true, isCorrect: true } },
      session: { select: { examId: true } },
    },
  });
  if (p.finishedAt && p.score != null) return { participant: p, changed: false };
  const questions = await prisma.question.findMany({ where: { examId: p.session.examId }, select: { id: true, points: true } });
  const { score, correct } = computeScore(questions, p.answers);
  // Chỉ cập nhật nếu chưa ai chốt trước (tránh hai yêu cầu đồng thời ghi đè).
  const res = await prisma.participant.updateMany({
    where: { id: p.id, finishedAt: null },
    data: { score, correctCount: correct, finishedAt: new Date() },
  });
  const fresh = await prisma.participant.findUniqueOrThrow({ where: { id: p.id } });
  return { participant: fresh, changed: res.count > 0 };
}

/** Thời gian ân hạn cho độ trễ mạng khi nhận đáp án sát giờ. */
export const GRACE_MS = 3000;
/** Đếm ngược trước khi bắt đầu làm bài. */
export const COUNTDOWN_MS = 3500;
