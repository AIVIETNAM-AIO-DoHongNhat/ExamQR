import type { QuestionType, Response } from "./question-types";

/**
 * Câu hỏi gửi xuống điện thoại (không kèm đáp án đúng).
 * SINGLE: options là phương án (đã đảo) · TRUE_FALSE: options là nhận định a–d · SHORT: options rỗng.
 */
export type PlayQuestion = { id: string; type: QuestionType; content: string; options: { id: string; content: string }[] };

export type ReviewItem = {
  type: QuestionType;
  content: string;
  points: number;
  /** Tỉ lệ điểm đạt được 0..1. */
  credit: number;
  /** SINGLE: chosen = đã chọn · TRUE_FALSE: isCorrect = nhận định Đúng, mark = học viên đánh · SHORT: đáp án được chấp nhận. */
  options: { id: string; content: string; isCorrect: boolean; chosen: boolean; mark?: boolean | null }[];
  /** SHORT: nội dung học viên đã gõ. */
  text?: string | null;
};

export type PlayState =
  | { kind: "not-found" }
  | { kind: "closed"; examTitle: string }
  | { kind: "join"; code: string; examTitle: string; status: "LOBBY" | "RUNNING" }
  | {
      kind: "lobby";
      code: string;
      sessionId: string;
      sbd: string;
      examTitle: string;
      total: number;
      durationMin: number;
    }
  | {
      kind: "play";
      code: string;
      sessionId: string;
      sbd: string;
      examTitle: string;
      startedAt: string;
      endsAt: string;
      serverNow: string;
      total: number;
      /** Toàn bộ câu hỏi theo thứ tự đã đảo riêng cho học viên này (không kèm đáp án đúng). */
      questions: PlayQuestion[];
      /** Câu trả lời đã lưu theo questionId. */
      chosen: Record<string, Response>;
    }
  | {
      kind: "result";
      code: string;
      sessionId: string;
      sbd: string;
      examTitle: string;
      score: number;
      correct: number;
      total: number;
      sessionEnded: boolean;
      /** Đáp án chi tiết chỉ trả về khi cả phòng đã kết thúc, tránh lộ đề cho người đang làm. */
      review: ReviewItem[] | null;
    };

export type JoinResult = { ok: true; state: PlayState } | { ok: false; error: string };
export type AnswerResult = { ok: true; state?: PlayState } | { ok: false; error: string; state?: PlayState };
