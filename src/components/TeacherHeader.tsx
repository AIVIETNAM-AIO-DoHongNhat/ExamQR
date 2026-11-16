import { Suspense } from "react";
import { brandLine } from "@/lib/brand";
import { signOut } from "@/server/teacher-actions";
import { AppHeader } from "./Brand";
import { LogOut } from "./icons";
import { TeacherNav } from "./TeacherNav";
import { buttonClass } from "./ui";

export function TeacherHeader({ email }: { email: string }) {
  return (
    <AppHeader href="/dashboard" subtitle={brandLine} height="h-16">
      <Suspense>
        <TeacherNav />
      </Suspense>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-[13px] text-on-dark-muted lg:inline">{email}</span>
        <form action={signOut}>
          <button className={buttonClass("ghost-inverse", "sm")}>
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Đăng xuất
          </button>
        </form>
      </div>
    </AppHeader>
  );
}
