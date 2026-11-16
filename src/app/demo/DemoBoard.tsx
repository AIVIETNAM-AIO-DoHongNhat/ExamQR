"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BoardParticipant, BoardState } from "@/lib/board-types";
import { Grid2D } from "@/components/board/Grid2D";
import { Summary } from "@/components/board/Summary";
import { Lobby } from "@/components/board/Lobby";
import { AnimatedNumber } from "@/components/board/AnimatedNumber";
import type { Pulse } from "@/components/board/types";
import { BrandMark } from "@/components/Brand";
import { Award, Box, LayoutGrid, LogOut, QrCode } from "@/components/icons";
import { buttonClass, cx } from "@/components/ui";
import { StatsStrip } from "@/components/board/StatsStrip";

const City3D = dynamic(() => import("@/components/board/City3D").then((m) => m.City3D), { ssr: false });

export function DemoBoard({ students, questions, view = "2d" }: { students: number; questions: number; view?: "3d" | "2d" | "summary" | "lobby" }) {
  const [mode, setMode] = useState<"3d" | "2d" | "summary" | "lobby">(view);
  const [speed, setSpeed] = useState(1);
  const [people, setPeople] = useState<BoardParticipant[]>(() =>
    Array.from({ length: students }, (_, i) => ({
      id: `p${i}`,
      sbd: String(i + 1).padStart(3, "0"),
      answered: 0,
      finished: false,
      score: null,
    })),
  );
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const seq = useRef(0);
  const peopleRef = useRef(people);

  // Mỗi nhịp, vài học viên ảo làm xong một câu.
  useEffect(() => {
    const id = setInterval(() => {
      const ps = peopleRef.current;
      const active = ps.filter((p) => !p.finished);
      if (!active.length) return;
      const k = Math.min(active.length, Math.max(1, Math.round(Math.random() * 3 * speed)));
      const picked = new Set(Array.from({ length: k }, () => active[Math.floor(Math.random() * active.length)].id));
      const next = ps.map((p) => {
        if (!picked.has(p.id)) return p;
        const answered = Math.min(questions, p.answered + 1);
        return { ...p, answered, finished: answered >= questions };
      });
      peopleRef.current = next;
      setPeople(next);
      const fresh = [...picked].map((pid) => ({ id: ++seq.current, pid, at: performance.now() }));
      setPulses((xs) => [...xs.slice(-40), ...fresh]);
      const ids = new Set(fresh.map((f) => f.id));
      setTimeout(() => setPulses((xs) => xs.filter((x) => !ids.has(x.id))), 1800);
    }, 700 / speed);
    return () => clearInterval(id);
  }, [speed, questions]);

  const total = people.reduce((s, p) => s + p.answered, 0);
  const progress = total / (students * questions);
  const finished = people.filter((p) => p.finished).length;

  const is3d = mode === "3d";
  const stats = [
    { label: "Thời gian còn lại", value: <span className="font-mono font-medium">12:34</span> },
    {
      label: "Câu cả lớp đã làm",
      value: (
        <>
          <AnimatedNumber value={total} />
          <span className={cx("text-[0.55em] font-medium", is3d ? "text-white/50" : "text-muted")}> / {students * questions}</span>
        </>
      ),
    },
    {
      label: "Đã nộp bài",
      value: (
        <>
          {finished}
          <span className={cx("text-[0.55em] font-medium", is3d ? "text-white/50" : "text-muted")}> / {students}</span>
        </>
      ),
    },
  ];

  return (
    <div className={cx("flex h-dvh flex-col overflow-hidden", is3d ? "bg-ink" : "bg-transparent")}>
      <header className="px-bar relative z-20 shrink-0">
        <div className="flex h-16 items-center gap-4 px-6">
          <BrandMark size={28} className="text-sun" />
          <div className="min-w-0">
            <p className="font-display text-[30px] font-bold leading-none text-on-dark">Thử màn chiếu</p>
            <p className="text-[13px] text-on-dark-muted">
              {students} học viên ảo · {questions} câu
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex border-2 border-white/25" role="group" aria-label="Kiểu hiển thị">
              {(
                [
                  ["lobby", "Phòng chờ", QrCode],
                  ["2d", "Bảng theo dõi", LayoutGrid],
                  ["3d", "Cảnh 3D", Box],
                  ["summary", "Tổng kết", Award],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cx(
                    "flex h-8 items-center gap-1.5 px-3 font-display text-[18px] font-semibold tracking-[0.04em] transition-colors",
                    mode === m ? "bg-sun text-ink" : "text-on-dark-muted hover:bg-white/10 hover:text-on-dark",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <span className="ml-3 font-display text-[18px] font-semibold text-on-dark-muted">Tốc độ</span>
            <div className="flex border-2 border-white/25">
              {[1, 3, 8].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={cx("h-8 px-3 font-display text-[18px] font-semibold tabular-nums", speed === s ? "bg-sun text-ink" : "text-on-dark-muted hover:bg-white/10 hover:text-on-dark")}
                >
                  ×{s}
                </button>
              ))}
            </div>
            <Link href="/" className={cx(buttonClass("ghost-inverse", "sm"), "ml-2")}>
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Thoát
            </Link>
          </div>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        {mode === "lobby" ? (
          <Lobby state={demoLobby(students)} busy={false} onStart={() => setMode("2d")} onKick={() => {}} />
        ) : mode === "summary" ? (
          <Summary state={demoSummary(students, questions)} />
        ) : is3d ? (
          <>
            <City3D participants={people} totalQuestions={questions} pulses={pulses} classProgress={progress} />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto max-w-5xl p-6">
              <StatsStrip items={stats} dark />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col gap-5 p-6">
            <StatsStrip items={stats} />
            <div className="px-track h-5 shrink-0">
              <div className="h-full bg-accent px-meter transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="min-h-0 flex-1">
              <Grid2D participants={people} totalQuestions={questions} pulses={pulses} onRejoin={() => {}} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Kết quả giả để xem thử màn tổng kết (điểm phân bố cố định theo SBD). */
function demoSummary(students: number, questions: number): BoardState {
  const participants = Array.from({ length: Math.max(1, students - 2) }, (_, i) => {
    const correct = Math.round(questions * (0.35 + ((i * 37) % 65) / 100));
    return {
      id: `p${i}`,
      sbd: String(i + 1).padStart(3, "0"),
      answered: questions,
      finished: true,
      score: Math.round((Math.min(questions, correct) / questions) * 1000) / 100,
    };
  });
  return {
    id: "demo",
    code: "DEMO00",
    status: "ENDED",
    allowLate: false,
    examTitle: "Bài kiểm tra thử",
    classCode: "Lớp thử",
    totalQuestions: questions,
    durationMin: 15,
    startedAt: null,
    endsAt: null,
    serverNow: new Date().toISOString(),
    roster: Array.from({ length: students }, (_, i) => String(i + 1).padStart(3, "0")),
    participants,
    hardest: [
      { index: 4, content: "Nội dung câu hỏi có tỉ lệ trả lời đúng thấp nhất trong bài kiểm tra thử.", rate: 0.28 },
      { index: 11, content: "Câu hỏi thứ hai cần giảng viên trao đổi thêm với lớp.", rate: 0.41 },
      { index: 7, content: "Câu hỏi thứ ba.", rate: 0.52 },
    ],
  };
}
/** Phòng chờ giả: khoảng hai phần ba lớp đã vào. */
function demoLobby(students: number): BoardState {
  const roster = Array.from({ length: students }, (_, i) => String(i + 1).padStart(3, "0"));
  return {
    ...demoSummary(students, 20),
    status: "LOBBY",
    code: "K7M2QX",
    hardest: undefined,
    participants: roster
      .filter((_, i) => (i * 7) % 10 < 7)
      .map((sbd, i) => ({ id: `p${i}`, sbd, answered: 0, finished: false, score: null })),
  };
}
