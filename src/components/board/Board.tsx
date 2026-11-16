"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardState } from "@/lib/board-types";
import type { RealtimeEvent } from "@/lib/events";
import { clockOffset, useServerNow, useSessionChannel } from "@/lib/use-session-channel";
import { fmtClock } from "@/lib/format";
import { brandLine } from "@/lib/brand";
import { allowRejoin, endSession, getBoardState, kickParticipant, setAllowLate, startSession } from "@/server/session-actions";
import { BrandMark } from "@/components/Brand";
import { useConfirm } from "@/components/Dialog";
import { Box, FileText, LayoutGrid, LogOut, Maximize, Square } from "@/components/icons";
import { Button, LinkButton, buttonClass, cx } from "@/components/ui";
import { Lobby } from "./Lobby";
import { Grid2D } from "./Grid2D";
import { Summary } from "./Summary";
import { AnimatedNumber } from "./AnimatedNumber";
import { StatsStrip } from "./StatsStrip";
import type { Pulse } from "./types";

const City3D = dynamic(() => import("./City3D").then((m) => m.City3D), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center font-display text-[24px] text-white/70">Đang dựng cảnh 3D…</div>,
});

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Board({ initial }: { initial: BoardState }) {
  const [state, setState] = useState(initial);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [mode, setMode] = useState<"3d" | "2d">("2d");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pulseSeq = useRef(0);
  const endingRef = useRef(false);
  const [ask, dialog] = useConfirm();

  // Mặc định bảng 2D trang nghiêm; chỉ vào cảnh 3D khi giảng viên đã chọn trước đó và máy hỗ trợ.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("examqr.boardMode");
    } catch {}
    setMode(saved === "3d" && hasWebGL() ? "3d" : "2d");
  }, []);
  const switchMode = (m: "3d" | "2d") => {
    setMode(m);
    try {
      localStorage.setItem("examqr.boardMode", m);
    } catch {}
  };

  const reload = useCallback(async () => {
    try {
      setState(await getBoardState(initial.id));
    } catch {}
  }, [initial.id]);

  const act = async (fn: () => Promise<BoardState>) => {
    setBusy(true);
    setError(null);
    try {
      setState(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  };

  const onEvent = useCallback(
    (e: RealtimeEvent) => {
      setState((s) => {
        switch (e.type) {
          case "participant:joined":
            if (s.participants.some((p) => p.id === e.pid)) return s;
            return { ...s, participants: [...s.participants, { id: e.pid, sbd: e.sbd, answered: 0, finished: false, score: null }] };
          case "participant:kicked":
            return { ...s, participants: s.participants.filter((p) => p.id !== e.pid) };
          case "progress:updated":
            return {
              ...s,
              participants: s.participants.map((p) => (p.id === e.pid ? { ...p, answered: Math.max(p.answered, e.answered) } : p)),
            };
          case "participant:finished":
            return { ...s, participants: s.participants.map((p) => (p.id === e.pid ? { ...p, finished: true } : p)) };
          default:
            return s;
        }
      });
      if (e.type === "progress:updated") {
        const id = ++pulseSeq.current;
        setPulses((ps) => [...ps.slice(-40), { id, pid: e.pid, at: performance.now() }]);
        setTimeout(() => setPulses((ps) => ps.filter((p) => p.id !== id)), 1200);
      }
      if (e.type === "session:ended" || e.type === "session:started") reload();
    },
    [reload],
  );

  const connected = useSessionChannel(state.id, onEvent, reload);

  // Đối chiếu với CSDL định kỳ: CSDL là nguồn đúng, realtime chỉ để cập nhật tức thì.
  useEffect(() => {
    const id = setInterval(reload, state.status === "ENDED" ? 60_000 : 10_000);
    return () => clearInterval(id);
  }, [reload, state.status]);

  const offset = useMemo(() => clockOffset(state.serverNow), [state.serverNow]);
  const now = useServerNow(offset);
  const endsAt = state.endsAt ? new Date(state.endsAt).getTime() : null;
  const startedAt = state.startedAt ? new Date(state.startedAt).getTime() : null;

  // Hết giờ (cộng thời gian ân hạn) thì tự kết thúc và chốt điểm.
  useEffect(() => {
    if (state.status === "RUNNING" && endsAt && now > endsAt + 4000 && !endingRef.current) {
      endingRef.current = true;
      act(() => endSession(state.id));
    }
  });

  // Mọi người đã nộp thì cũng kết thúc luôn.
  const finishedCount = state.participants.filter((p) => p.finished).length;
  const allDone = state.status === "RUNNING" && state.participants.length > 0 && finishedCount === state.participants.length;
  useEffect(() => {
    if (!allDone || endingRef.current) return;
    const t = setTimeout(() => {
      if (!endingRef.current) {
        endingRef.current = true;
        act(() => endSession(state.id));
      }
    }, 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, state.id]);

  const totalAnswered = state.participants.reduce((s, p) => s + p.answered, 0);
  const totalPossible = Math.max(1, state.participants.length * state.totalQuestions);
  const classProgress = totalAnswered / totalPossible;

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  async function onStart() {
    const joined = state.participants.length;
    const total = state.roster.length;
    if (joined < total) {
      const ok = await ask({
        title: "Bắt đầu khi chưa đủ người?",
        message: (
          <p>
            Mới có <b>{joined}/{total}</b> học viên vào phòng. Người vào sau chỉ làm được bài nếu bật “Cho vào muộn”.
          </p>
        ),
        confirmLabel: "Bắt đầu",
        cancelLabel: "Chờ thêm",
      });
      if (!ok) return;
    }
    act(() => startSession(state.id));
  }

  async function onEnd() {
    const left = state.participants.length - finishedCount;
    const ok = await ask({
      title: "Kết thúc bài kiểm tra?",
      message: (
        <p>
          {left > 0 ? (
            <>
              Còn <b>{left}</b> học viên chưa nộp bài. Bài của các đồng chí này sẽ được chốt điểm theo các câu đã làm.
            </>
          ) : (
            "Tất cả học viên đã nộp bài."
          )}
        </p>
      ),
      confirmLabel: "Kết thúc",
      cancelLabel: "Tiếp tục làm bài",
      tone: "danger",
    });
    if (!ok) return;
    endingRef.current = true;
    act(() => endSession(state.id));
  }

  async function onRejoin(pid: string) {
    const p = state.participants.find((x) => x.id === pid);
    if (!p) return;
    const ok = await ask({
      title: `Cho SBD ${p.sbd} vào lại?`,
      message: <p>Dùng khi học viên đổi điện thoại. Thiết bị mới nhập lại số báo danh để làm tiếp, các câu đã làm vẫn được giữ.</p>,
      confirmLabel: "Cho vào lại",
    });
    if (ok) act(() => allowRejoin(state.id, pid));
  }

  async function onKick(pid: string) {
    const p = state.participants.find((x) => x.id === pid);
    const ok = await ask({
      title: `Mời SBD ${p?.sbd ?? ""} ra khỏi phòng?`,
      message: <p>Dùng khi học viên nhập nhầm số báo danh. Học viên có thể nhập lại số đúng.</p>,
      confirmLabel: "Mời ra",
      tone: "danger",
    });
    if (ok) act(() => kickParticipant(state.id, pid));
  }

  const is3d = state.status === "RUNNING" && mode === "3d";
  const remaining = endsAt != null ? endsAt - now : null;
  const stats = [
    {
      label: "Thời gian còn lại",
      value: (
        <span className="font-mono font-medium">
          {startedAt && now < startedAt ? `−${Math.ceil((startedAt - now) / 1000)}s` : remaining != null ? fmtClock(remaining) : "–"}
        </span>
      ),
      tone: remaining != null && remaining < 60_000 ? ("danger" as const) : remaining != null && remaining < 5 * 60_000 ? ("warn" as const) : undefined,
    },
    {
      label: "Câu cả lớp đã làm",
      value: (
        <>
          <AnimatedNumber value={totalAnswered} />
          <span className={cx("text-[0.55em] font-medium", is3d ? "text-white/50" : "text-muted")}> / {state.participants.length * state.totalQuestions}</span>
        </>
      ),
    },
    {
      label: "Đã nộp bài",
      value: (
        <>
          {finishedCount}
          <span className={cx("text-[0.55em] font-medium", is3d ? "text-white/50" : "text-muted")}> / {state.participants.length}</span>
        </>
      ),
    },
  ];

  return (
    <div className={cx("flex h-dvh flex-col overflow-hidden", is3d ? "bg-ink" : "bg-transparent")}>
      {dialog}
      <header className="px-bar relative z-20 shrink-0">
        <div className="flex h-16 items-center gap-4 px-6">
          <BrandMark size={28} className="text-sun" />
          <div className="min-w-0">
            <p className="truncate font-display text-[30px] font-bold leading-none text-on-dark">{state.examTitle}</p>
            <p className="truncate text-[13px] text-on-dark-muted">
              {brandLine} · Lớp {state.classCode} · {state.totalQuestions} câu · {state.durationMin} phút
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span
              className={cx("mr-2 flex items-center gap-1.5 font-display text-[18px] font-semibold tracking-[0.04em]", connected ? "text-mint" : "text-sun")}
              title={connected ? "Đang nhận cập nhật trực tiếp" : "Mất kết nối trực tiếp, vẫn cập nhật mỗi 10 giây"}
            >
              <span className={cx("h-2.5 w-2.5", connected ? "bg-mint" : "animate-pulse bg-sun")} />
              {connected ? "Trực tiếp" : "Đang kết nối lại"}
            </span>
            {state.status === "RUNNING" && (
              <>
                <div className="flex border-2 border-white/25" role="group" aria-label="Kiểu hiển thị">
                  {(
                    [
                      ["2d", "Bảng theo dõi", LayoutGrid],
                      ["3d", "Cảnh 3D", Box],
                    ] as const
                  ).map(([m, label, Icon]) => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
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
                <label className={cx(buttonClass("secondary-inverse", "sm"), "cursor-pointer")}>
                  <input
                    type="checkbox"
                    checked={state.allowLate}
                    onChange={(e) => act(() => setAllowLate(state.id, e.target.checked))}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  Cho vào muộn
                </label>
                <Button variant="danger-solid" size="sm" disabled={busy} onClick={onEnd}>
                  <Square className="h-3 w-3 fill-current" aria-hidden />
                  Kết thúc
                </Button>
              </>
            )}
            {state.status === "ENDED" && (
              <LinkButton href={`/sessions/${state.id}/report`} size="sm">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Xem báo cáo
              </LinkButton>
            )}
            <Button variant="ghost-inverse" size="sm" onClick={fullscreen} title="Toàn màn hình" aria-label="Toàn màn hình">
              <Maximize className="h-4 w-4" aria-hidden />
            </Button>
            <LinkButton href="/dashboard" variant="ghost-inverse" size="sm">
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Thoát
            </LinkButton>
          </div>
        </div>
      </header>

      {error && <div className="z-20 border-b-2 border-ink bg-sun px-6 py-2 text-sm font-semibold text-ink">{error}</div>}

      <div className="relative min-h-0 flex-1">
        {state.status === "LOBBY" && <Lobby state={state} busy={busy} onStart={onStart} onKick={onKick} />}

        {state.status === "RUNNING" &&
          (is3d ? (
            <>
              <City3D participants={state.participants} totalQuestions={state.totalQuestions} pulses={pulses} classProgress={classProgress} />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto max-w-5xl p-6">
                <StatsStrip items={stats} dark />
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col gap-5 px-6 pb-6 pt-6">
              <StatsStrip items={stats} />
              <div className="px-track h-5 shrink-0">
                <div className="h-full bg-accent px-meter transition-[width] duration-700" style={{ width: `${classProgress * 100}%` }} />
              </div>
              <div className="min-h-0 flex-1">
                <Grid2D participants={state.participants} totalQuestions={state.totalQuestions} pulses={pulses} onRejoin={onRejoin} />
              </div>
              {state.allowLate && (
                <p className="mx-auto shrink-0 border-2 border-ink bg-sun px-5 py-1 text-center font-display text-[22px] font-semibold tracking-[0.04em] text-ink">
                  Đang cho vào muộn · mã phòng <span className="font-bold tracking-[0.12em]">{state.code}</span>
                </p>
              )}
            </div>
          ))}

        {state.status === "ENDED" && <Summary state={state} />}
      </div>
    </div>
  );
}
