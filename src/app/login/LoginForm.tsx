"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Alert, Button, Input, Label } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        const { error } = await supabaseBrowser().auth.signInWithPassword({
          email: String(fd.get("email")),
          password: String(fd.get("password")),
        });
        if (error) {
          setError("Email hoặc mật khẩu không đúng");
          setPending(false);
          return;
        }
        // Tải lại toàn trang để server đọc cookie phiên mới.
        window.location.href = next;
      }}
    >
      <label>
        <Label>Email</Label>
        <Input name="email" type="email" required autoComplete="username" />
      </label>
      <label>
        <Label>Mật khẩu</Label>
        <Input name="password" type="password" required autoComplete="current-password" />
      </label>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
