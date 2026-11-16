/**
 * Phân tích danh sách số báo danh giảng viên nhập:
 * - khoảng "001-040" (giữ số chữ số theo đầu khoảng), có thể có tiền tố chữ: "A01-A40"
 * - danh sách cách nhau bởi dấu phẩy, chấm phẩy, khoảng trắng hoặc xuống dòng
 */
export function parseSbdInput(input: string): { values: string[]; errors: string[] } {
  const values: string[] = [];
  const errors: string[] = [];
  const tokens = input.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  for (const tok of tokens) {
    const range = tok.match(/^([A-Za-z]*)(\d+)-(?:[A-Za-z]*)(\d+)$/);
    if (range) {
      const [, prefix, fromStr, toStr] = range;
      const from = parseInt(fromStr, 10);
      const to = parseInt(toStr, 10);
      if (to < from || to - from > 500) {
        errors.push(`Khoảng không hợp lệ: ${tok}`);
        continue;
      }
      for (let n = from; n <= to; n++) values.push(prefix + String(n).padStart(fromStr.length, "0"));
      continue;
    }
    if (/^[A-Za-z0-9_.]{1,20}$/.test(tok)) values.push(tok);
    else errors.push(`Số báo danh không hợp lệ: ${tok}`);
  }
  return { values: [...new Set(values.map(normalizeSbd))], errors };
}

export function normalizeSbd(s: string) {
  return s.trim().toUpperCase();
}

/**
 * Tìm số báo danh học viên nhập trong danh sách lớp. Khớp chính xác trước;
 * nếu không có và học viên chỉ gõ chữ số thì chấp nhận khi bỏ số 0 ở đầu ("15" → "015"),
 * miễn là chỉ có đúng một số báo danh như vậy.
 */
export function matchSbd<T extends { sbd: string }>(roster: readonly T[], input: string): T | null {
  const sbd = normalizeSbd(input);
  if (!sbd) return null;
  const exact = roster.find((r) => r.sbd === sbd);
  if (exact) return exact;
  if (!/^\d+$/.test(sbd)) return null;
  const n = parseInt(sbd, 10);
  const hits = roster.filter((r) => /^\d+$/.test(r.sbd) && parseInt(r.sbd, 10) === n);
  return hits.length === 1 ? hits[0] : null;
}

/** Sắp xếp SBD theo số tự nhiên (A2 trước A10). */
export const compareSbd = (a: string, b: string) =>
  a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });
