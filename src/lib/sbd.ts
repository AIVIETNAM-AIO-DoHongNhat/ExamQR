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

/** Sắp xếp SBD theo số tự nhiên (A2 trước A10). */
export const compareSbd = (a: string, b: string) =>
  a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });
