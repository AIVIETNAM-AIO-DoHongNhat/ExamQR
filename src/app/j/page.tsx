import type { Metadata } from "next";
import { BrandHeading } from "@/components/Brand";
import { JoinCodeForm } from "@/components/play/JoinCodeForm";

export const metadata: Metadata = { title: "Vào phòng – ExamQR" };

const STEPS = ["Quét mã QR trên màn chiếu hoặc nhập mã phòng", "Nhập số báo danh", "Chờ giảng viên bắt đầu và làm bài"];

/** Trang nhập mã phòng cho học viên không quét được QR (QR trỏ thẳng tới /j/<mã>). */
export default function JoinByCode() {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-4 py-14">
        <BrandHeading />
        <div className="px-card mt-12 p-6 sm:p-7">
          <JoinCodeForm />
        </div>
        <ol className="mt-12 flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={i} className="flex items-center gap-4 text-[15px] leading-relaxed text-ink-soft">
              <span className="grid h-9 w-9 shrink-0 place-items-center border-2 border-ink bg-sun font-display text-[24px] font-bold leading-none text-ink">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
