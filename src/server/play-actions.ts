"use server";

import { cookies, headers } from "next/headers";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/realtime";
import { normalizeSbd } from "@/lib/sbd";
import { deriveSeed, seededShuffle, shuffleWithinRuns } from "@/lib/shuffle";
import { cookieName, hashNonce, newNonce, signParticipant, verifyParticipant } from "@/lib/token";
import type { AnswerResult, JoinResult, PlayState } from "@/lib/play-types";
import { SHORT_MAX, creditOf, grade, responseFromRow, type Response } from "@/lib/question-types";
import { GRACE_MS, finalizeParticipant } from "./grading";
import { rateLimit } from "./rate-limit";

const normCode = (code: string) => code.trim().toUpperCase().slice(0, 12);

async function findSession(code: string) {
  return prisma.session.findUnique({
    where: { code: normCode(code) },
    include: { exam: { select: { id: true, title: true, durationMin: true } } },
  });
}

/** Người tham gia gắn với cookie của thiết bị này, hoặc null. */
async function currentParticipant(sessionId: string) {
  const jar = await cookies();
  const tok = await verifyParticipant(jar.get(cookieName(sessionId))?.value);
  if (!tok || tok.sid !== sessionId) return null;
  const p = await prisma.participant.findUnique({ where: { id: tok.pid }, include: { student: true } });
  if (!p || p.sessionId !== sessionId || p.tokenHash !== hashNonce(tok.nonce)) return null;
  return p;
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

type SessionRow = NonNullable<Awaited<ReturnType<typeof findSession>>>;
type ParticipantRow = NonNullable<Awaited<ReturnType<typeof currentParticipant>>>;

async function buildState(s: SessionRow, p: ParticipantRow | null): Promise<PlayState> {
  const base = { code: s.code, sessionId: s.id, examTitle: s.exam.title };

  if (!p) {
    if (s.status === "ENDED") return { kind: "closed", examTitle: s.exam.title };
    if (s.status === "RUNNING" && !s.allowLate) return { kind: "closed", examTitle: s.exam.title };
    return { kind: "join", code: s.code, examTitle: s.exam.title, status: s.status };
  }

  const sbd = p.student.sbd;
  if (s.status === "LOBBY") {
    const total = await prisma.question.count({ where: { examId: s.examId } });
    return { kind: "lobby", ...base, sbd, total, durationMin: s.exam.durationMin };
  }

  const now = Date.now();
  const timeUp = s.status === "ENDED" || (s.endsAt != null && now > s.endsAt.getTime() + GRACE_MS);

  let finishedAt = p.finishedAt;
  if (!finishedAt && timeUp) {
    const r = await finalizeParticipant(p.id);
    finishedAt = r.participant.finishedAt;
    if (r.changed) await broadcast(s.id, { type: "participant:finished", pid: p.id, sbd });
  }

  const questions = await prisma.question.findMany({
    where: { examId: s.examId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });

  if (finishedAt) {
    const fresh = await prisma.participant.findUniqueOrThrow({ where: { id: p.id }, include: { answers: true } });
    const ended = s.status === "ENDED";
    const byQ = new Map(fresh.answers.map((a) => [a.questionId, a]));
    return {
      kind: "result",
      ...base,
      sbd,
      score: fresh.score ?? 0,
      correct: fresh.correctCount,
      total: questions.length,
      sessionEnded: ended,
      review: ended
        ? questions.map((q) => {
            const a = byQ.get(q.id);
            const marks = (a?.marks ?? {}) as Record<string, boolean>;
            return {
              type: q.type,
              content: q.content,
              points: q.points,
              credit: a ? creditOf(a) : 0,
              text: a?.text ?? null,
              options: q.options.map((o) => ({
                id: o.id,
                content: o.content,
                isCorrect: o.isCorrect,
                chosen: a?.optionId === o.id,
                mark: q.type === "TRUE_FALSE" ? (marks[o.id] ?? null) : undefined,
              })),
            };
          })
        : null,
    };
  }

  const answers = await prisma.answer.findMany({ where: { participantId: p.id }, select: { questionId: true, optionId: true, text: true, marks: true } });
  const typeOf = new Map(questions.map((q) => [q.id, q.type]));
  const chosen: Record<string, Response> = {};
  for (const a of answers) {
    const r = responseFromRow(typeOf.get(a.questionId) ?? "SINGLE", a);
    if (r) chosen[a.questionId] = r;
  }
  // Đảo câu trong từng phần cùng dạng để giữ bố cục đề (trắc nghiệm → Đúng/Sai → trả lời ngắn).
  const ordered = shuffleWithinRuns(questions, (q) => q.type, p.seed);
  return {
    kind: "play",
    ...base,
    sbd,
    startedAt: s.startedAt!.toISOString(),
    endsAt: s.endsAt!.toISOString(),
    serverNow: new Date().toISOString(),
    total: questions.length,
    chosen,
    // Không bao giờ gửi isCorrect (và đáp án của câu trả lời ngắn) xuống điện thoại khi đang làm bài.
    questions: ordered.map((q) => ({
      id: q.id,
      type: q.type,
      content: q.content,
      options:
        q.type === "SHORT"
          ? []
          : // Nhận định Đúng/Sai giữ thứ tự a–d; phương án trắc nghiệm được đảo.
            (q.type === "TRUE_FALSE" ? q.options : seededShuffle(q.options, deriveSeed(p.seed, q.id))).map((o) => ({ id: o.id, content: o.content })),
    })),
  };
}

export async function getPlayState(code: string): Promise<PlayState> {
  const s = await findSession(code);
  if (!s) return { kind: "not-found" };
  return buildState(s, await currentParticipant(s.id));
}

export async function joinSession(code: string, rawSbd: string): Promise<JoinResult> {
  const ip = await clientIp();
  if (!rateLimit(`join:${ip}`, 20, 60_000)) return { ok: false, error: "Thử quá nhiều lần, vui lòng đợi một phút" };

  const s = await findSession(code);
  if (!s) return { ok: false, error: "Không tìm thấy phòng" };

  const existing = await currentParticipant(s.id);
  if (existing) return { ok: true, state: await buildState(s, existing) };

  if (s.status === "ENDED") return { ok: false, error: "Phòng đã kết thúc" };
  if (s.status === "RUNNING" && !s.allowLate) return { ok: false, error: "Bài kiểm tra đã bắt đầu. Đồng chí vui lòng báo giảng viên." };

  const sbd = normalizeSbd(rawSbd);
  if (!sbd) return { ok: false, error: "Nhập số báo danh" };
  const student = await prisma.student.findUnique({ where: { classId_sbd: { classId: s.classId, sbd } } });
  if (!student) return { ok: false, error: `Số báo danh ${sbd} không có trong danh sách lớp` };

  const nonce = newNonce();
  const tokenHash = hashNonce(nonce);
  let pid: string;

  const prior = await prisma.participant.findUnique({ where: { sessionId_studentId: { sessionId: s.id, studentId: student.id } } });
  if (prior) {
    // Chỉ cho nhận lại khi giảng viên đã bấm "cho vào lại" (tokenHash = null).
    const claimed = await prisma.participant.updateMany({ where: { id: prior.id, tokenHash: null }, data: { tokenHash } });
    if (claimed.count === 0) return { ok: false, error: `Số báo danh ${sbd} đã được dùng trên thiết bị khác. Nếu không phải đồng chí, vui lòng báo giảng viên.` };
    pid = prior.id;
  } else {
    try {
      const p = await prisma.participant.create({
        data: { sessionId: s.id, studentId: student.id, tokenHash, seed: randomInt(1, 2 ** 31 - 1) },
      });
      pid = p.id;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { ok: false, error: `Số báo danh ${sbd} vừa được dùng trên thiết bị khác` };
      throw e;
    }
    await broadcast(s.id, { type: "participant:joined", pid, sbd });
  }

  const jar = await cookies();
  jar.set(cookieName(s.id), await signParticipant(pid, s.id, nonce), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  const p = await prisma.participant.findUniqueOrThrow({ where: { id: pid }, include: { student: true } });
  return { ok: true, state: await buildState(s, p) };
}

/** Kiểm tra phiên và người làm bài có đang được phép ghi bài không. */
async function activeParticipant(code: string) {
  const s = await findSession(code);
  if (!s) return { error: { ok: false as const, error: "Không tìm thấy phòng" } };
  const p = await currentParticipant(s.id);
  if (!p) return { error: { ok: false as const, error: "Phiên làm bài không hợp lệ", state: await buildState(s, null) } };
  const now = Date.now();
  if (s.status !== "RUNNING" || p.finishedAt || !s.startedAt || !s.endsAt) {
    return { error: { ok: false as const, error: "Không thể ghi bài lúc này", state: await buildState(s, p) } };
  }
  if (now < s.startedAt.getTime() - 500) return { error: { ok: false as const, error: "Chưa đến giờ làm bài" } };
  if (now > s.endsAt.getTime() + GRACE_MS) return { error: { ok: false as const, error: "Đã hết giờ", state: await buildState(s, p) } };
  return { s, p };
}

/** Kiểm tra dữ liệu câu trả lời từ điện thoại (không tin dữ liệu gửi lên). */
function cleanResponse(type: string, optionIds: Set<string>, r: Response): Response | null {
  if (!r || typeof r !== "object") return null;
  if (type === "SINGLE" && r.kind === "single") return optionIds.has(r.optionId) ? r : null;
  if (type === "TRUE_FALSE" && r.kind === "tf" && r.marks && typeof r.marks === "object") {
    const marks: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(r.marks)) {
      if (!optionIds.has(k) || typeof v !== "boolean") return null;
      marks[k] = v;
    }
    return { kind: "tf", marks };
  }
  if (type === "SHORT" && r.kind === "short" && typeof r.text === "string") return { kind: "short", text: r.text.slice(0, SHORT_MAX) };
  return null;
}

const answerData = (r: Response, credit: number) => ({
  optionId: r.kind === "single" ? r.optionId : null,
  marks: r.kind === "tf" ? r.marks : undefined,
  text: r.kind === "short" ? r.text : null,
  credit,
  isCorrect: credit >= 1,
});

/**
 * Lưu (hoặc đổi) câu trả lời cho một câu. Học viên được sửa đến khi nộp bài hoặc hết giờ.
 * Tiến độ trên màn chiếu chỉ tăng khi trả lời câu mới, đổi câu trả lời không tính thêm.
 */
export async function saveAnswer(code: string, questionId: string, response: Response): Promise<AnswerResult> {
  const r = await activeParticipant(code);
  if (r.error) return r.error;
  const { s, p } = r;
  if (!rateLimit(`ans:${p.id}`, 150, 60_000)) return { ok: false, error: "Thao tác quá nhanh, đợi giây lát" };

  const question = await prisma.question.findFirst({
    where: { id: questionId, examId: s.examId },
    select: { type: true, options: { select: { id: true, content: true, isCorrect: true } } },
  });
  if (!question) return { ok: false, error: "Câu hỏi không hợp lệ" };
  const clean = cleanResponse(question.type, new Set(question.options.map((o) => o.id)), response);
  if (!clean) return { ok: false, error: "Câu trả lời không hợp lệ" };
  const data = answerData(clean, grade(question.type, question.options, clean));

  const change = () =>
    prisma.answer.updateMany({
      // Không sửa sau khi bài đã chốt điểm.
      where: { participantId: p.id, questionId, participant: { finishedAt: null } },
      data: { ...data, answeredAt: new Date() },
    });

  const existing = await prisma.answer.findUnique({
    where: { participantId_questionId: { participantId: p.id, questionId } },
    select: { id: true },
  });
  if (existing) {
    await change();
    return { ok: true };
  }

  let answered: number;
  try {
    const [, updated] = await prisma.$transaction([
      prisma.answer.create({ data: { participantId: p.id, questionId, ...data } }),
      prisma.participant.update({ where: { id: p.id }, data: { answeredCount: { increment: 1 } } }),
    ]);
    answered = updated.answeredCount;
  } catch (e) {
    // Hai yêu cầu cùng lúc cho một câu: bản ghi đã có, chỉ cần cập nhật.
    if ((e as { code?: string }).code === "P2002") {
      await change();
      return { ok: true };
    }
    throw e;
  }

  await broadcast(s.id, { type: "progress:updated", pid: p.id, sbd: p.student.sbd, answered });
  return { ok: true };
}

/** Học viên chủ động nộp bài: chốt điểm ngay. */
export async function submitExam(code: string): Promise<AnswerResult> {
  const r = await activeParticipant(code);
  if (r.error) return r.error;
  const { s, p } = r;
  const fin = await finalizeParticipant(p.id);
  if (fin.changed) await broadcast(s.id, { type: "participant:finished", pid: p.id, sbd: p.student.sbd });
  // Dùng bản ghi sau khi chốt để trả về màn kết quả (bản `p` đọc trước đó vẫn chưa có finishedAt).
  return { ok: true, state: await buildState(s, { ...p, finishedAt: fin.participant.finishedAt }) };
}

/** Rời phòng chờ (đổi số báo danh nhập nhầm). Chỉ được khi chưa bắt đầu. */
export async function leaveLobby(code: string): Promise<PlayState> {
  const s = await findSession(code);
  if (!s) return { kind: "not-found" };
  const p = await currentParticipant(s.id);
  if (p && s.status === "LOBBY") {
    await prisma.participant.delete({ where: { id: p.id } });
    await broadcast(s.id, { type: "participant:kicked", pid: p.id, sbd: p.student.sbd });
    (await cookies()).delete(cookieName(s.id));
    return buildState(s, null);
  }
  return buildState(s, p);
}
