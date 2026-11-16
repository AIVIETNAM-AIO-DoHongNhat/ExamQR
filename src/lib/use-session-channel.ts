"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "./supabase-browser";
import { sessionChannel, type RealtimeEvent } from "./events";

/**
 * Nghe sự kiện Broadcast của một phiên. Gọi onReconnect mỗi khi (re)subscribe thành công
 * để giao diện tải lại trạng thái thật từ CSDL, bù cho sự kiện có thể bị rớt khi mất mạng.
 */
export function useSessionChannel(
  sessionId: string | null,
  onEvent: (e: RealtimeEvent) => void,
  onReconnect?: () => void,
) {
  const eventRef = useRef(onEvent);
  const reconnectRef = useRef(onReconnect);
  eventRef.current = onEvent;
  reconnectRef.current = onReconnect;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const supabase = supabaseBrowser();
    let subscribedOnce = false;
    const ch = supabase
      .channel(sessionChannel(sessionId), { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "*" }, (msg) => {
        const payload = msg.payload as RealtimeEvent | undefined;
        if (payload?.type) eventRef.current(payload);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          if (subscribedOnce) reconnectRef.current?.();
          subscribedOnce = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId]);

  return connected;
}

/** Độ lệch đồng hồ giữa máy này và server (ms), để mọi thiết bị đếm giờ giống nhau. */
export function clockOffset(serverNowIso: string) {
  return new Date(serverNowIso).getTime() - Date.now();
}

/** Bộ đếm cập nhật mỗi 250ms, trả về "giờ server" ước tính. */
export function useServerNow(offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(id);
  }, [offset]);
  return now;
}
