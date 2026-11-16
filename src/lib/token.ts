import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

const secret = () => {
  const s = process.env.PARTICIPANT_TOKEN_SECRET;
  if (!s) throw new Error("Thiếu PARTICIPANT_TOKEN_SECRET");
  return new TextEncoder().encode(s);
};

export const cookieName = (sessionId: string) => `p_${sessionId.replace(/-/g, "")}`;

export function newNonce() {
  return randomBytes(24).toString("base64url");
}

export function hashNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

export async function signParticipant(pid: string, sid: string, nonce: string) {
  return new SignJWT({ pid, sid, n: nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(secret());
}

export async function verifyParticipant(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.pid !== "string" || typeof payload.sid !== "string" || typeof payload.n !== "string") {
      return null;
    }
    return { pid: payload.pid, sid: payload.sid, nonce: payload.n };
  } catch {
    return null;
  }
}
