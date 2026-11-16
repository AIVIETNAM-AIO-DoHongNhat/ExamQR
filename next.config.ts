import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép chạy song song nhiều server dev (mỗi server một thư mục build riêng).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
