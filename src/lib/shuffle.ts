/** PRNG có hạt giống (mulberry32) để mỗi học viên có thứ tự câu/đáp án cố định khi tải lại. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Đảo câu trong từng nhóm liền nhau cùng dạng, giữ thứ tự các phần của đề
 * (ví dụ: phần trắc nghiệm → phần Đúng/Sai → phần trả lời ngắn).
 */
export function shuffleWithinRuns<T>(items: readonly T[], keyOf: (x: T) => string, seed: number): T[] {
  const out: T[] = [];
  let start = 0;
  for (let i = 1; i <= items.length; i++) {
    if (i === items.length || keyOf(items[i]) !== keyOf(items[start])) {
      out.push(...seededShuffle(items.slice(start, i), deriveSeed(seed, `run${start}`)));
      start = i;
    }
  }
  return out;
}

/** Hạt giống riêng cho từng câu, để thứ tự đáp án của các câu khác nhau. */
export function deriveSeed(seed: number, key: string) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x85ebca6b) >>> 0;
  return h >>> 0;
}
