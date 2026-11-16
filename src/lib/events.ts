export type RealtimeEvent =
  | { type: "participant:joined"; pid: string; sbd: string }
  | { type: "participant:kicked"; pid: string; sbd: string }
  | { type: "session:started"; startedAt: string; endsAt: string }
  | { type: "progress:updated"; pid: string; sbd: string; answered: number }
  | { type: "participant:finished"; pid: string; sbd: string }
  | { type: "session:ended" };

export const sessionChannel = (sessionId: string) => `session:${sessionId}`;
