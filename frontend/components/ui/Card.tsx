import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "paper" | "white" | "soft" | "navy" | "muted" | "primary";
}

const tones = {
  paper: "bg-paper border-navy/10",
  white: "bg-white border-navy/10",
  soft: "bg-ivory border-navy/10",
  navy: "bg-navy text-white border-white/10",
  muted: "bg-mist/60 border-navy/10",
  primary: "bg-teal-soft/60 border-teal/15",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone = "paper", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-3xl border shadow-card", tones[tone], className)}
      {...props}
    />
  ),
);

Card.displayName = "Card";
