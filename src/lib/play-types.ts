export type PlayQuestion = { id: string; content: string; options: { id: string; content: string }[] };

export type ReviewItem = {
  content: string;
  points: number;
  options: { id: string; content: string; isCorrect: boolean; chosen: boolean }[];
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
      /** Đáp án đã lưu: questionId → optionId. */
      chosen: Record<string, string>;
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
