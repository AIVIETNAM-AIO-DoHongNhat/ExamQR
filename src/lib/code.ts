import { randomInt } from "node:crypto";

// Bỏ các ký tự dễ nhầm: 0/O, 1/I/L
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newRoomCode(length = 6) {
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}
