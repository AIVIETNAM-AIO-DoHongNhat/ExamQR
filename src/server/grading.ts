import "server-only";
import type { SessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime";
import { computeScore } from "@/lib/scoring";
import { creditOf } from "@/lib/question-types";

/**
 * Chốt điểm mọi bài chưa nộp của một phiên. Đọc đề và bài làm một lần rồi ghi từng người
 * (thay vì gọi finalizeParticipant từng người: ~4 truy vấn/người, chậm khi lớp đông).
 */
export async function finalizeSession(sessionId: string, examId: string) {
  const [questions, pending] = await Promise.all([
    prisma.question.findMany({ where: { examId }, select: { id: true, points: true } }),
    prisma.participant.findMany({
      where: { sessionId, finishedAt: null },
      select: { id: true, answers: { select: { questionId: true, isCorrect: true, credit: true } } },
    }),
  ]);
  const at = new Date();
  for (const p of pending) {
    const { score, correct } = computeScore(questions, p.answers.map((a) => ({ questionId: a.questionId, credit: creditOf(a) })));
    await prisma.participant.updateMany({ where: { id: p.id, finishedAt: null }, data: { score, correctCount: correct, finishedAt: at } });
  }
}

/** Kết thúc phiên và chốt điểm người chưa nộp. Gọi lại nhiều lần vẫn an toàn. */
export async function closeSession(s: { id: string; examId: string; status: SessionStatus }) {
  let changed = false;
  if (s.status !== "ENDED") {
    const now = new Date();
    const res = await prisma.session.updateMany({
      where: { id: s.id, status: { not: "ENDED" } },
      data: { status: "ENDED", endedAt: now, ...(s.status === "LOBBY" ? { startedAt: now, endsAt: now } : {}) },
    });
    changed = res.count > 0;
  }
  await finalizeSession(s.id, s.examId);
  if (changed) await broadcast(s.id, { type: "session:ended" });
}

/** Tính lại điểm các bài đã chốt (sau khi giảng viên chấm lại câu trả lời ngắn). */
export async function rescoreParticipants(examId: string, participantIds: string[]) {
  if (!participantIds.length) return;
  const questions = await prisma.question.findMany({ where: { examId }, select: { id: true, points: true } });
  const ps = await prisma.participant.findMany({
    where: { id: { in: participantIds }, finishedAt: { not: null } },
    include: { answers: { select: { questionId: true, isCorrect: true, credit: true } } },
  });
  for (const p of ps) {
    const { score, correct } = computeScore(questions, p.answers.map((a) => ({ questionId: a.questionId, credit: creditOf(a) })));
    await prisma.participant.update({ where: { id: p.id }, data: { score, correctCount: correct } });
  }
}

/** Chấm và chốt điểm một người (idempotent: đã chốt thì trả lại kết quả cũ). */
export async function finalizeParticipant(participantId: string) {
  const p = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    include: {
      answers: { select: { questionId: true, isCorrect: true, credit: true } },
      session: { select: { examId: true } },
    },
  });
  if (p.finishedAt && p.score != null) return { participant: p, changed: false };
  const questions = await prisma.question.findMany({ where: { examId: p.session.examId }, select: { id: true, points: true } });
  const { score, correct } = computeScore(questions, p.answers.map((a) => ({ questionId: a.questionId, credit: creditOf(a) })));
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
