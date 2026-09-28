import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "./Card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  change?: number;
  icon: LucideIcon;
  tone?: "teal" | "amber" | "navy" | "coral" | "blue" | "green" | "red";
  className?: string;
}

const tones = {
  teal: "bg-teal-soft text-teal",
  amber: "bg-saffron-soft text-[#9A570A]",
  navy: "bg-navy/8 text-navy",
  coral: "bg-red-50 text-coral",
  blue: "bg-sky-50 text-sky-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
};

export function StatCard({
  label,
  value,
  detail,
  change,
  icon: Icon,
  tone = "teal",
  className,
}: StatCardProps) {
  const positive = typeof change === "number" && change >= 0;
  return (
    <Card className={cn("group p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid size-10 place-items-center rounded-2xl", tones[tone])}>
          <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </div>
        {typeof change === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-bold",
              positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.13em] text-navy/50">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-[-0.035em] text-navy sm:text-[28px]">
        {value}
      </p>
      {detail && <p className="mt-1.5 text-xs leading-5 text-navy/55">{detail}</p>}
    </Card>
  );
}
