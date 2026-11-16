export const fmtScore = (n: number | null | undefined) =>
  n == null ? "–" : n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export const fmtTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("vi-VN", { hour12: false }) : "–";

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
