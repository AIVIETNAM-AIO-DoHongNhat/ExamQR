"use client";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

/** Số nhảy dần tới giá trị mới. */
export function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("vi-VN"));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.6, ease: "easeOut" });
    return () => c.stop();
  }, [mv, value]);
  return (
    <motion.span key={value} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="inline-block">
      <motion.span>{text}</motion.span>
    </motion.span>
  );
}
