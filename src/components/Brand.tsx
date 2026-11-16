import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/lib/brand";
import { PixelRule, cx } from "./ui";

/** Ký hiệu ứng dụng: góc định vị của mã QR vẽ bằng ô vuông sắc cạnh. Dùng logo đơn vị nếu đã cấu hình. */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  if (brand.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logo} alt="" width={size} height={size} className={cx("shrink-0 object-contain", className)} style={{ width: size, height: size }} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden shapeRendering="crispEdges" className={cx("shrink-0 text-accent", className)}>
      <path fillRule="evenodd" d="M0 0h28v28H0zM4 4v20h20V4z" fill="currentColor" />
      <rect x="9" y="9" width="10" height="10" fill="currentColor" />
    </svg>
  );
}

/** Khối nhận diện ở trang chủ, đăng nhập: ký hiệu trong ô pixel, tên ứng dụng chữ pixel lớn có bóng vàng. */
export function BrandHeading({ subtitle, className }: { subtitle?: string; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center text-center", className)}>
      <span className="px-card grid h-[76px] w-[76px] place-items-center">
        <BrandMark size={brand.logo ? 56 : 40} />
      </span>
      {(brand.orgName || brand.orgUnit) && (
        <div className="mt-7">
          {brand.orgName && <p className="font-display text-[18px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{brand.orgName}</p>}
          {brand.orgUnit && <p className="mt-0.5 text-[14px] text-muted">{brand.orgUnit}</p>}
        </div>
      )}
      <h1 className="mt-6 font-display text-[76px] font-extrabold leading-[0.85] text-ink [text-shadow:4px_4px_0_var(--color-sun)]">{brand.appName}</h1>
      <PixelRule className="mt-4" />
      <p className="mt-3 text-[16px] text-muted">{subtitle ?? "Kiểm tra trắc nghiệm trên lớp"}</p>
    </div>
  );
}

/** Thanh đầu trang chung (giảng viên, màn chiếu): nền chàm đậm đặc, dính trên cùng. */
export function AppHeader({
  title,
  subtitle,
  href,
  children,
  className,
  height = "h-14",
  maxWidth = "max-w-6xl",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  children?: ReactNode;
  className?: string;
  height?: string;
  maxWidth?: string;
}) {
  const ident = (
    <span className="flex min-w-0 items-center gap-3">
      <BrandMark size={26} className="text-sun" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-[26px] font-bold leading-none text-on-dark">{title ?? brand.appName}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[12px] text-on-dark-muted">{subtitle}</span>}
      </span>
    </span>
  );
  return (
    <header className={cx("px-bar no-print sticky top-0 z-30", className)}>
      <div className={cx("mx-auto flex items-center gap-4 px-4 sm:px-6", height, maxWidth)}>
        {href ? (
          <Link href={href} className="min-w-0">
            {ident}
          </Link>
        ) : (
          ident
        )}
        {children}
      </div>
    </header>
  );
}
