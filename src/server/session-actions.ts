"use server";

import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime";
import { compareSbd } from "@/lib/sbd";
import { hardestQuestions, questionStats } from "@/lib/stats";
import type { BoardState } from "@/lib/board-types";
import { requireTeacher } from "./auth";
import { COUNTDOWN_MS, finalizeParticipant } from "./grading";

async function ownSession(sessionId: string) {
  const t = await requireTeacher();
  const s = await prisma.session.findFirst({
    where: { id: sessionId, exam: { teacherId: t.id } },
    include: { exam: true, class: true },
  });
  if (!s) throw new Error("Không tìm thấy buổi kiểm tra");
  return s;
}

export async function getBoardState(sessionId: string): Promise<BoardState> {
  const s = await ownSession(sessionId);
  const [roster, participants, totalQuestions] = await Promise.all([
    prisma.student.findMany({ where: { classId: s.classId }, select: { sbd: true } }),
    prisma.participant.findMany({
      where: { sessionId },
      include: { student: { select: { sbd: true } } },
    }),
    prisma.question.count({ where: { examId: s.examId } }),
  ]);
  const ended = s.status === "ENDED";
  let hardest: BoardState["hardest"];
  if (ended) {
    const [questions, answers] = await Promise.all([
      prisma.question.findMany({
        where: { examId: s.examId },
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      }),
      prisma.answer.findMany({ where: { participant: { sessionId } }, select: { questionId: true, optionId: true, isCorrect: true, credit: true, text: true, marks: true } }),
    ]);
    hardest = hardestQuestions(questionStats(questions, answers), 3).map((q) => ({ index: q.index, content: q.content, rate: q.rate }));
  }
  return {
    hardest,
    id: s.id,
    code: s.code,
    status: s.status,
    allowLate: s.allowLate,
    examTitle: s.exam.title,
    classCode: s.class.code,
    totalQuestions,
    durationMin: s.exam.durationMin,
    startedAt: s.startedAt?.toISOString() ?? null,
    endsAt: s.endsAt?.toISOString() ?? null,
    serverNow: new Date().toISOString(),
    roster: roster.map((r) => r.sbd).sort(compareSbd),
    participants: participants
      .map((p) => ({
        id: p.id,
        sbd: p.student.sbd,
        answered: p.answeredCount,
        finished: p.finishedAt != null,
        score: ended ? p.score : null,
      }))
      .sort((a, b) => compareSbd(a.sbd, b.sbd)),
  };
}

export async function startSession(sessionId: string) {
  const s = await ownSession(sessionId);
  if (s.status !== "LOBBY") return getBoardState(sessionId);
  const startedAt = new Date(Date.now() + COUNTDOWN_MS);
  const endsAt = new Date(startedAt.getTime() + s.exam.durationMin * 60_000);
  const res = await prisma.session.updateMany({
    where: { id: s.id, status: "LOBBY" },
    data: { status: "RUNNING", startedAt, endsAt },
  });
  if (res.count > 0) {
    await broadcast(s.id, { type: "session:started", startedAt: startedAt.toISOString(), endsAt: endsAt.toISOString() });
  }
  return getBoardState(sessionId);
}

/** Kết thúc phiên: chốt điểm cho tất cả người chưa nộp. Gọi lại nhiều lần vẫn an toàn. */
export async function endSession(sessionId: string) {
  const s = await ownSession(sessionId);
  if (s.status !== "ENDED") {
    await prisma.session.update({
      where: { id: s.id },
      data: { status: "ENDED", endedAt: new Date(), ...(s.status === "LOBBY" ? { startedAt: new Date(), endsAt: new Date() } : {}) },
    });
  }
  const pending = await prisma.participant.findMany({ where: { sessionId, finishedAt: null }, select: { id: true } });
  for (const p of pending) await finalizeParticipant(p.id);
  if (s.status !== "ENDED") await broadcast(s.id, { type: "session:ended" });
  return getBoardState(sessionId);
}

export async function kickParticipant(sessionId: string, participantId: string) {
  const s = await ownSession(sessionId);
  const p = await prisma.participant.findFirst({
    where: { id: participantId, sessionId: s.id },
    include: { student: true, _count: { select: { answers: true } } },
  });
  if (!p) return getBoardState(sessionId);
  if (p._count.answers > 0) throw new Error("Học viên đã làm bài, không thể mời ra");
  await prisma.participant.delete({ where: { id: p.id } });
  await broadcast(s.id, { type: "participant:kicked", pid: p.id, sbd: p.student.sbd });
  return getBoardState(sessionId);
}

/** Cho phép số báo danh này vào lại từ một thiết bị khác (khi học viên đổi máy). */
export async function allowRejoin(sessionId: string, participantId: string) {
  const s = await ownSession(sessionId);
  await prisma.participant.updateMany({ where: { id: participantId, sessionId: s.id }, data: { tokenHash: null } });
  return getBoardState(sessionId);
}

export async function setAllowLate(sessionId: string, allowLate: boolean) {
  const s = await ownSession(sessionId);
  await prisma.session.update({ where: { id: s.id }, data: { allowLate } });
  return getBoardState(sessionId);
}
