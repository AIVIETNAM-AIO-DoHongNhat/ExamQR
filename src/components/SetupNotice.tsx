import Link from "next/link";
import { BrandMark } from "./Brand";

/** Trang hướng dẫn khi máy chủ chưa có đủ biến môi trường, thay cho lỗi 500 khó hiểu. */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-14">
      <div className="px-card w-full max-w-[560px] p-7 sm:p-9">
        <BrandMark size={32} />
        <h1 className="mt-5 font-display text-[44px] font-bold leading-tight text-ink">Hệ thống chưa được cấu hình</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Máy chủ thiếu các biến môi trường để kết nối cơ sở dữ liệu và đăng nhập. Học viên chưa vào phòng được cho đến khi quản trị viên cấu hình xong.
        </p>
        <div className="mt-6 border-2 border-ink bg-sun-soft p-5">
          <p className="font-display text-[22px] font-bold leading-none text-ink">Biến còn thiếu</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {missing.map((k) => (
              <li key={k} className="font-mono text-sm text-ink">
                {k}
              </li>
            ))}
          </ul>
        </div>
        <ol className="mt-6 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <span className="mr-3 inline-grid h-6 w-6 place-items-center border-2 border-ink bg-sun font-display text-[17px] font-bold text-ink">1</span>
            Sao chép <code className="font-mono text-sm">.env.example</code> thành <code className="font-mono text-sm">.env</code> và điền giá trị từ dự án Supabase.
          </li>
          <li>
            <span className="mr-3 inline-grid h-6 w-6 place-items-center border-2 border-ink bg-sun font-display text-[17px] font-bold text-ink">2</span>
            Chạy <code className="font-mono text-sm">npm run db:push</code> để tạo bảng.
          </li>
          <li>
            <span className="mr-3 inline-grid h-6 w-6 place-items-center border-2 border-ink bg-sun font-display text-[17px] font-bold text-ink">3</span>
            Khởi động lại máy chủ (<code className="font-mono text-sm">npm run dev</code>). Trên Vercel: thêm biến ở Settings → Environment Variables rồi deploy lại.
          </li>
        </ol>
        <p className="mt-8 text-[13px] text-muted">
          Trong lúc chờ, có thể xem thử giao diện tại{" "}
          <Link href="/demo" className="text-accent underline-offset-4 hover:underline">
            /demo
          </Link>{" "}
          và{" "}
          <Link href="/demo/play" className="text-accent underline-offset-4 hover:underline">
            /demo/play
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
