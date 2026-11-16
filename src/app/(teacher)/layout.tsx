import { missingEnv } from "@/lib/env";
import { SetupNotice } from "@/components/SetupNotice";
import { TeacherHeader } from "@/components/TeacherHeader";
import { requireTeacher } from "@/server/auth";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const missing = missingEnv();
  if (missing.length) return <SetupNotice missing={missing} />;
  const t = await requireTeacher();
  return (
    <div className="min-h-dvh">
      <TeacherHeader email={t.email} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
