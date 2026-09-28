import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "teal"
  | "amber"
  | "green"
  | "red"
  | "blue"
  | "dark";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-navy/6 text-navy/70 ring-navy/10",
  teal: "bg-teal-soft text-teal ring-teal/15",
  amber: "bg-saffron-soft text-[#8A4B08] ring-saffron/20",
  green: "bg-emerald-100 text-emerald-800 ring-emerald-600/15",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  blue: "bg-sky-50 text-sky-800 ring-sky-600/15",
  dark: "bg-navy text-white ring-white/10",
};

const dotTones: Record<BadgeTone, string> = {
  neutral: "bg-navy/45",
  teal: "bg-teal",
  amber: "bg-saffron",
  green: "bg-emerald-600",
  red: "bg-red-600",
  blue: "bg-sky-600",
  dark: "bg-white",
};

export function Badge({
  className,
  tone = "neutral",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none tracking-wide ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotTones[tone])} />}
      {children}
    </span>
  );
}
