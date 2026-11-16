export type BoardParticipant = {
  id: string;
  sbd: string;
  answered: number;
  finished: boolean;
  /** Chỉ có khi phiên đã kết thúc. */
  score: number | null;
};

export type BoardState = {
  id: string;
  code: string;
  status: "LOBBY" | "RUNNING" | "ENDED";
  allowLate: boolean;
  examTitle: string;
  classCode: string;
  totalQuestions: number;
  durationMin: number;
  startedAt: string | null;
  endsAt: string | null;
  serverNow: string;
  roster: string[];
  participants: BoardParticipant[];
  /** Chỉ có khi phiên đã kết thúc: các câu tỉ lệ đúng thấp nhất để chữa tại lớp. */
  hardest?: { index: number; content: string; rate: number }[];
};
