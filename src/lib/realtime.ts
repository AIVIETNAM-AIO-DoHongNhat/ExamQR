import "server-only";
import { sessionChannel, type RealtimeEvent } from "./events";

/**
 * Phát sự kiện Broadcast từ server qua REST API của Supabase Realtime.
 * Sự kiện chỉ là tín hiệu để giao diện cập nhật ngay; dữ liệu thật luôn nằm trong CSDL.
 * Lỗi phát sự kiện không được làm hỏng thao tác chính, nên chỉ ghi log.
 */
export async function broadcast(sessionId: string, event: RealtimeEvent) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ topic: sessionChannel(sessionId), event: event.type, payload: event }],
      }),
      cache: "no-store",
    });
    if (!res.ok) console.error("broadcast failed", res.status, await res.text());
  } catch (err) {
    console.error("broadcast error", err);
  }
}
