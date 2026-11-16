import "server-only";

/**
 * Giới hạn tần suất đơn giản trong bộ nhớ của từng instance serverless.
 * Đủ để chặn việc dò số báo danh hàng loạt từ một máy; không phải giới hạn toàn cục.
 */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return true;
  }
  b.count++;
  return b.count <= limit;
}
