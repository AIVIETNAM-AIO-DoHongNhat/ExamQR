"use client";

import { useMemo, useState } from "react";
import type { PlayState } from "@/lib/play-types";
import { PlayShell } from "@/components/play/PlayApp";
import { JoinForm } from "@/components/play/JoinForm";
import { WaitingRoom } from "@/components/play/WaitingRoom";
import { ExamScreen, type ExamApi } from "@/components/play/ExamScreen";
import { ResultScreen } from "@/components/play/ResultScreen";

export type DemoView = "join" | "lobby" | "exam" | "review" | "result";

const QUESTIONS = [
  {
    q: "Theo quan điểm của chủ nghĩa duy vật lịch sử, yếu tố nào giữ vai trò quyết định sự vận động, phát triển của xã hội?",
    a: ["Phương thức sản xuất vật chất", "Hệ tư tưởng chính trị", "Điều kiện địa lý tự nhiên", "Dân số và mật độ dân số"],
  },
  {
    q: "Đại hội đại biểu toàn quốc lần thứ VI của Đảng (1986) gắn với nội dung nào?",
    a: ["Khởi xướng đường lối đổi mới toàn diện", "Thống nhất đất nước", "Gia nhập Tổ chức Thương mại Thế giới", "Ban hành Hiến pháp 1992"],
  },
  { q: "Nguyên tắc tổ chức cơ bản của Đảng Cộng sản Việt Nam là gì?", a: ["Tập trung dân chủ", "Tập thể lãnh đạo", "Tự phê bình và phê bình", "Đoàn kết thống nhất"] },
];

function fakeQuestions(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const src = QUESTIONS[i % QUESTIONS.length];
    return {
      id: `q${i}`,
      content: src.q,
      options: src.a.map((c, j) => ({ id: `q${i}o${j}`, content: c })),
    };
  });
}

const base = { code: "K7M2QX", sessionId: "demo", sbd: "015", examTitle: "Kiểm tra giữa học phần Triết học Mác – Lênin" };

export function DemoPlay({ view }: { view: DemoView }) {
  const playState = useMemo<Extract<PlayState, { kind: "play" }>>(() => {
    const questions = fakeQuestions(20);
    const now = Date.now();
    const chosen: Record<string, string> = {};
    questions.slice(0, view === "review" ? 17 : 6).forEach((q) => (chosen[q.id] = q.options[0].id));
    return {
      kind: "play",
      ...base,
      startedAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 12 * 60_000 + 34_000).toISOString(),
      serverNow: new Date(now).toISOString(),
      total: questions.length,
      questions,
      chosen,
    };
  }, [view]);

  const [state, setState] = useState<PlayState>(() => {
    if (view === "join") return { kind: "join", code: base.code, examTitle: base.examTitle, status: "LOBBY" };
    if (view === "lobby") return { kind: "lobby", ...base, total: 20, durationMin: 15 };
    if (view === "result") return resultState();
    return playState;
  });

  // Hàm giả thay cho server: lưu luôn thành công sau một nhịp, nộp bài trả về kết quả.
  const api: ExamApi = {
    save: () => new Promise((r) => setTimeout(() => r({ ok: true }), 250)),
    submit: async () => ({ ok: true, state: resultState() }),
  };

  return (
    <PlayShell title={"examTitle" in state ? state.examTitle : null} sbd={"sbd" in state ? state.sbd : null}>
      {state.kind === "join" && (
        <JoinForm code={base.code} examTitle={base.examTitle} onJoined={setState} join={async () => ({ ok: true, state: { kind: "lobby", ...base, total: 20, durationMin: 15 } })} />
      )}
      {state.kind === "lobby" && <WaitingRoom state={state} onLeave={() => setState({ kind: "join", code: base.code, examTitle: base.examTitle, status: "LOBBY" })} />}
      {state.kind === "play" && (
        <ExamScreen state={state} onState={setState} refresh={async () => {}} api={api} initialView={view === "review" ? "review" : "question"} />
      )}
      {state.kind === "result" && <ResultScreen state={state} />}
    </PlayShell>
  );
}

function resultState(): Extract<PlayState, { kind: "result" }> {
  const qs = fakeQuestions(5);
  return {
    kind: "result",
    ...base,
    score: 8.5,
    correct: 17,
    total: 20,
    sessionEnded: true,
    review: qs.map((q, i) => ({
      content: q.content,
      points: 1,
      options: q.options.map((o, j) => ({ id: o.id, content: o.content, isCorrect: j === 0, chosen: i === 1 ? j === 2 : i === 3 ? false : j === 0 })),
    })),
  };
}
