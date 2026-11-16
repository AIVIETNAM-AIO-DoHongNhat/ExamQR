import { PixelRule } from "@/components/ui";

/**
 * Khung hiện ngay khi chuyển trang trong khu giảng viên, trong lúc server lấy dữ liệu.
 * Có file này Next.js mới prefetch được phần tĩnh của trang động, nên bấm link thấy phản hồi tức thì.
 */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Đang tải…</span>
      <div className="flex flex-col gap-3">
        <div className="h-12 w-72 max-w-full bg-ink/10" />
        <PixelRule />
      </div>
      <div className="px-card flex flex-col gap-4 p-5 sm:p-7">
        <div className="h-7 w-48 bg-ink/10" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-10 w-full bg-ink/5" />
        ))}
      </div>
    </div>
  );
}
