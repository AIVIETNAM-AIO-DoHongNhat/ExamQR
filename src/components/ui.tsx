import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Info } from "./icons";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid" | "success" | "ghost-inverse" | "secondary-inverse";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "px-press bg-accent text-white hover:bg-accent-hover",
  secondary: "px-press bg-white text-ink hover:bg-accent-soft",
  ghost: "text-ink-soft hover:bg-ink/[0.07] hover:text-ink",
  danger: "px-press bg-white text-danger hover:bg-danger-soft",
  "danger-solid": "px-press bg-danger text-white hover:bg-danger/90",
  success: "px-press bg-mint text-ink hover:bg-mint/85",
  "ghost-inverse": "text-on-dark-muted hover:bg-white/10 hover:text-on-dark",
  "secondary-inverse": "border-2 border-white/25 bg-white/[0.06] text-on-dark hover:border-sun hover:text-sun",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return cx(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-display font-bold tracking-[0.04em] transition-[color,background-color,border-color,transform,box-shadow] duration-100 disabled:opacity-45 disabled:pointer-events-none",
    size === "sm" && "h-9 px-3.5 text-[17px]",
    size === "md" && "h-11 px-5 text-[20px]",
    size === "lg" && "h-13 px-6 text-[22px]",
    variants[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={cx(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...props} />;
}

/** Hàng ba ô vuông màu: chữ ký thị giác dưới tiêu đề. */
export function PixelRule({ className }: { className?: string }) {
  return (
    <span className={cx("flex gap-1", className)} aria-hidden>
      <span className="h-2 w-2 bg-accent" />
      <span className="h-2 w-2 bg-sun" />
      <span className="h-2 w-2 bg-mint" />
    </span>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("px-card p-5 sm:p-7", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[30px] font-bold leading-none text-ink">{title}</h2>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const fieldClass =
  "w-full border-2 border-ink bg-white px-3.5 text-[15px] text-ink shadow-[inset_0_3px_0_0_rgb(26_29_58/0.08)] outline-none transition-[border-color,box-shadow] placeholder:text-muted/70 focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-soft)] disabled:bg-paper disabled:text-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldClass, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldClass, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldClass, "h-11 pr-8", className)} {...props} />;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("mb-1.5 block font-display text-[18px] font-semibold tracking-[0.04em] text-ink-soft", className)}>{children}</span>;
}

type Tone = "neutral" | "red" | "green" | "gold";
const badgeTones: Record<Tone, string> = {
  neutral: "border-ink/40 bg-paper text-ink-soft",
  red: "border-accent bg-accent-soft text-accent",
  green: "border-ok bg-mint-soft text-ok",
  gold: "border-ink bg-sun text-ink",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap border-2 px-2 py-px font-display text-[16px] font-semibold leading-tight tracking-[0.04em]", badgeTones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 border-2 border-dashed border-ink/35 bg-white/70 px-6 py-14 text-center">
      <PixelRule className="mb-2" />
      {title && <p className="font-display text-[26px] font-bold leading-none text-ink">{title}</p>}
      {children && <div className="max-w-md text-[15px] leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "error" | "warn" | "success" | "accent";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    info: { box: "bg-white text-ink-soft", icon: "bg-accent-soft text-accent" },
    accent: { box: "bg-white text-ink", icon: "bg-accent text-white" },
    error: { box: "bg-danger-soft text-danger", icon: "bg-danger text-white" },
    warn: { box: "bg-warn-soft text-ink", icon: "bg-sun text-ink" },
    success: { box: "bg-mint-soft text-ok", icon: "bg-mint text-ink" },
  }[tone];
  const Icon = tone === "error" || tone === "warn" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("px-tile flex items-start gap-3 px-3 py-3 text-[15px] leading-relaxed", styles.box, className)}>
      <span className={cx("grid h-7 w-7 shrink-0 place-items-center border-2 border-ink", styles.icon)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}

/** Đầu trang nội dung: đường quay lại, tiêu đề pixel, hàng ô màu, dòng phụ và nhóm hành động. */
export function PageHeader({
  back,
  title,
  subtitle,
  actions,
}: {
  back?: { href: string; label: string };
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {back && (
        <Link href={back.href} className="no-print inline-flex w-fit items-center gap-1.5 font-display text-[18px] font-semibold tracking-[0.04em] text-muted transition-colors hover:text-accent">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[44px] font-bold leading-[0.95] text-ink sm:text-[52px]">{title}</h1>
          <PixelRule className="mt-3" />
          {subtitle && <p className="mt-3 text-[15px] text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "ink",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "ink" | "accent" | "ok" | "warn";
  className?: string;
}) {
  const t = {
    ink: { text: "text-ink", bar: "bg-ink" },
    accent: { text: "text-accent", bar: "bg-accent" },
    ok: { text: "text-ok", bar: "bg-mint" },
    warn: { text: "text-warn", bar: "bg-sun" },
  }[tone];
  return (
    <div className={cx("px-card print-break-avoid relative overflow-hidden px-5 pb-4 pt-5", className)}>
      <span className={cx("absolute inset-x-0 top-0 h-1.5", t.bar)} aria-hidden />
      <p className="font-display text-[17px] font-bold tracking-[0.06em] text-ink-soft">{label}</p>
      <p className={cx("mt-1 font-display text-[52px] font-bold leading-none tabular-nums", t.text)}>{value}</p>
      {sub && <p className="mt-2 text-[14px] text-muted">{sub}</p>}
    </div>
  );
}

export function Tabs({ items, active }: { items: { key: string; label: ReactNode; href: string }[]; active: string }) {
  return (
    <nav className="flex w-fit max-w-full overflow-x-auto border-2 border-ink bg-white" aria-label="Mục">
      {items.map((it, i) => (
        <Link
          key={it.key}
          href={it.href}
          aria-current={active === it.key ? "page" : undefined}
          className={cx(
            "whitespace-nowrap px-4 py-1.5 font-display text-[20px] font-semibold tracking-[0.04em] transition-colors",
            i > 0 && "border-l-2 border-ink",
            active === it.key ? "bg-accent text-white" : "text-ink-soft hover:bg-accent-soft hover:text-ink",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("px-card overflow-x-auto", className)}>
      <table className="w-full text-[15px]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cx("border-b-2 border-ink bg-accent-soft px-4 py-2 text-left font-display text-[18px] font-semibold tracking-[0.05em] text-ink-soft", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("h-12 border-b-2 border-line px-4 py-2.5 group-last/row:border-b-0", className)}>{children}</td>;
}

/** Hàng bảng có hiệu ứng rê chuột; dòng cuối không kẻ dưới. */
export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cx("group/row transition-colors hover:bg-sun-soft", className)}>{children}</tr>;
}
