"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getPlayState, leaveLobby } from "@/server/play-actions";
import type { PlayState } from "@/lib/play-types";
import { useSessionChannel } from "@/lib/use-session-channel";
import { brandLine } from "@/lib/brand";
import { BrandMark } from "@/components/Brand";
import { AlertTriangle } from "@/components/icons";
import { JoinCodeForm } from "./JoinCodeForm";
import { JoinForm } from "./JoinForm";
import { WaitingRoom } from "./WaitingRoom";
import { ExamScreen } from "./ExamScreen";
import { ResultScreen } from "./ResultScreen";
import { TextSizeToggle } from "./TextSizeToggle";

export function PlayApp({ code, initial }: { code: string; initial: PlayState }) {
  const [state, setState] = useState<PlayState>(initial);

  const refresh = useCallback(async () => {
    try {
      setState(await getPlayState(code));
    } catch {
      /* mạng lỗi: giữ trạng thái hiện tại, lần sau thử lại */
    }
  }, [code]);

  const sessionId = "sessionId" in state ? state.sessionId : null;
  const mySbd = "sbd" in state ? state.sbd : null;

  useSessionChannel(
    sessionId,
    (e) => {
      if (e.type === "session:started" || e.type === "session:ended") refresh();
      if (e.type === "participant:kicked" && e.sbd === mySbd) refresh();
    },
    // Khi đang làm bài, tải lại sẽ dựng lại màn hình; trạng thái đáp án đã nằm trên server nên không mất.
    state.kind === "play" ? undefined : refresh,
  );

  // Dự phòng khi realtime rớt: hỏi lại server định kỳ ở phòng chờ và màn kết quả chờ đáp án.
  const pollMs = state.kind === "lobby" ? 4000 : state.kind === "result" && !state.sessionEnded ? 10000 : 0;
  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [pollMs, refresh]);

  return (
    <PlayShell title={"examTitle" in state ? state.examTitle : null} sbd={mySbd}>
      {state.kind === "not-found" && (
        <Notice title={`Không tìm thấy phòng ${code}`} text="Đồng chí kiểm tra lại mã phòng trên màn chiếu.">
          <div className="mt-8 w-full text-left">
            <JoinCodeForm />
          </div>
        </Notice>
      )}
      {state.kind === "closed" && (
        <Notice
          title="Phòng không nhận thêm người"
          text="Bài kiểm tra đã bắt đầu hoặc đã kết thúc. Đồng chí vui lòng báo giảng viên nếu cần vào."
        />
      )}
      {state.kind === "join" && <JoinForm code={code} examTitle={state.examTitle} onJoined={setState} />}
      {state.kind === "lobby" && <WaitingRoom state={state} onLeave={async () => setState(await leaveLobby(code))} />}
      {state.kind === "play" && <ExamScreen key={state.sessionId} state={state} onState={setState} refresh={refresh} />}
      {state.kind === "result" && <ResultScreen state={state} />}
    </PlayShell>
  );
}

/** Khung trang học viên: thanh đầu trang chàm đậm và cột nội dung hẹp. */
export function PlayShell({ title, sbd, children }: { title: string | null; sbd: string | null; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="px-bar">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4 sm:px-6">
          <BrandMark size={22} className="text-sun" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-display text-[22px] font-bold leading-none text-on-dark">{title ?? "ExamQR"}</p>
            <p className="truncate text-xs text-on-dark-muted">{sbd ? <span className="font-mono">SBD {sbd}</span> : brandLine}</p>
          </div>
          <TextSizeToggle />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 sm:px-6">{children}</div>
    </main>
  );
}

function Notice({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <span className="grid h-14 w-14 place-items-center border-[3px] border-ink bg-sun">
        <AlertTriangle className="h-7 w-7 text-ink" strokeWidth={2} aria-hidden />
      </span>
      <p className="mt-5 font-display text-[34px] font-bold leading-none text-ink">{title}</p>
      <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-muted">{text}</p>
      {children}
    </div>
  );
}
