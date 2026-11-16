"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./ui";

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
};

/**
 * Hộp thoại xác nhận thay cho confirm() của trình duyệt: chữ lớn, nút rõ ràng.
 * Dùng: const [ask, dialog] = useConfirm(); if (await ask({...})) ...; và render {dialog}.
 */
export function useConfirm(): [(o: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const ask = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false);
    setOpts(o);
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);

  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);

  return [ask, opts ? <ConfirmDialog key={opts.title} {...opts} onClose={close} /> : null];
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Đồng ý",
  cancelLabel = "Hủy",
  tone = "primary",
  onClose,
}: ConfirmOptions & { onClose: (v: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
      className="m-auto w-[min(92vw,30rem)] border-[3px] border-ink bg-white p-0 text-ink shadow-[8px_8px_0_0_var(--color-ink)]"
      aria-labelledby="confirm-title"
    >
      <div className="flex flex-col gap-3 p-7">
        <h2 id="confirm-title" className="font-display text-[32px] font-bold leading-none text-ink">
          {title}
        </h2>
        {message && <div className="text-[15px] leading-relaxed text-ink-soft">{message}</div>}
      </div>
      <div className="flex flex-col-reverse gap-3 border-t-2 border-ink bg-accent-soft px-7 py-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => onClose(false)}>
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger-solid" : "primary"} onClick={() => onClose(true)} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
