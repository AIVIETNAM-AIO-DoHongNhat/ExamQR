"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "@/components/icons";
import { Button, buttonClass } from "@/components/ui";

/** Trang lỗi chung khi một trang gặp sự cố ngoài dự kiến (ví dụ mất kết nối CSDL). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-14">
      <div className="px-card w-full max-w-[460px] p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center border-[3px] border-ink bg-sun">
          <AlertTriangle className="h-7 w-7 text-ink" strokeWidth={2} aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-[40px] font-bold leading-none text-ink">Đã có lỗi xảy ra</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Hệ thống tạm thời không xử lý được yêu cầu. Đồng chí vui lòng thử lại sau ít phút; nếu vẫn lỗi, báo quản trị viên.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-muted">Mã lỗi: {error.digest}</p>}
        <div className="mt-7 flex justify-center gap-3">
          <Button onClick={reset}>Thử lại</Button>
          <Link href="/" className={buttonClass("secondary")}>
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
