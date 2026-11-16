import { missingEnv } from "@/lib/env";
import { LinkButton } from "@/components/ui";
import { SetupNotice } from "@/components/SetupNotice";
import { BrandHeading } from "@/components/Brand";
import { ArrowLeft } from "@/components/icons";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-14">
      <div className="w-full max-w-[420px]">
        <BrandHeading subtitle="Đăng nhập dành cho giảng viên" />
        <div className="px-card mt-12 p-6 sm:p-8">
          <LoginForm next={next?.startsWith("/") ? next : "/dashboard"} />
        </div>
        <p className="mt-5 text-center text-[14px] text-muted">Tài khoản do quản trị hệ thống cấp.</p>
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <LinkButton href="/j" variant="secondary" size="sm">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Học viên nhập mã phòng
        </LinkButton>
        <LinkButton href="/demo" variant="secondary" size="sm">
          Thử màn chiếu
        </LinkButton>
      </div>
    </main>
  );
}
