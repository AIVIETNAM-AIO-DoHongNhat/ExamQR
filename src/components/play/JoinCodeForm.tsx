"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "@/components/icons";
import { Button } from "@/components/ui";

export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase();
        if (!c) return;
        setPending(true);
        router.push(`/j/${c}`);
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-center font-display text-[26px] font-bold leading-none text-ink">Mã phòng trên màn chiếu</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
          placeholder="K7M2QX"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="h-18 w-full border-[3px] border-ink bg-paper text-center font-display text-[44px] font-bold tracking-[0.3em] text-ink outline-none transition-[border-color,box-shadow,background-color] placeholder:text-ink/20 focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_var(--color-accent-soft)]"
        />
      </label>
      <Button type="submit" size="lg" className="w-full" disabled={pending || code.trim().length < 4}>
        {pending ? "Đang mở…" : "Vào phòng"}
        {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
      </Button>
    </form>
  );
}
