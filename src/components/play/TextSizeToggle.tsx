"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

const SIZES = [
  { key: "base", label: "A", title: "Cỡ chữ thường", cls: "text-[17px]" },
  { key: "lg", label: "A", title: "Cỡ chữ lớn", cls: "text-[21px]" },
  { key: "xl", label: "A", title: "Cỡ chữ rất lớn", cls: "text-[25px]" },
] as const;
const STORE = "examqr.fs";

/** Chọn cỡ chữ cho học viên; ghi nhớ trên máy. */
export function TextSizeToggle() {
  const [fs, setFs] = useState<string>("base");

  useEffect(() => {
    let saved = "base";
    try {
      saved = localStorage.getItem(STORE) || "base";
    } catch {}
    apply(saved);
    return () => {
      delete document.documentElement.dataset.fs;
    };
  }, []);

  function apply(v: string) {
    const key = SIZES.some((s) => s.key === v) ? v : "base";
    setFs(key);
    document.documentElement.dataset.fs = key;
    try {
      localStorage.setItem(STORE, key);
    } catch {}
  }

  return (
    <div className="flex items-center border-2 border-white/25" role="group" aria-label="Cỡ chữ">
      {SIZES.map((s, i) => (
        <button
          key={s.key}
          type="button"
          title={s.title}
          aria-label={s.title}
          aria-pressed={fs === s.key}
          onClick={() => apply(s.key)}
          className={cx(
            "grid h-8 w-8 place-items-center font-display font-bold leading-none transition-colors",
            s.cls,
            i > 0 && "border-l-2 border-white/25",
            fs === s.key ? "bg-sun text-ink" : "text-on-dark-muted hover:bg-white/10 hover:text-on-dark",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
