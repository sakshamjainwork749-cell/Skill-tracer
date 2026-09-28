import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-saffron text-navy shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="size-9" fill="none">
        <path d="M8 25.5V10.7l10 10 10-10v14.8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="18" cy="20.8" r="2.4" fill="#0B7A75" />
      </svg>
    </span>
  );
}

export function Brand({
  href = "/",
  inverse = false,
  compact = false,
  showDescriptor = false,
  className,
}: {
  href?: string;
  inverse?: boolean;
  compact?: boolean;
  showDescriptor?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/20", className)}
      aria-label="SkillTrace home"
    >
      <BrandMark />
      {!compact && (
        <span className="leading-none">
          <span className={cn("block text-lg font-extrabold tracking-[-0.035em]", inverse ? "text-white" : "text-navy")}>
            Skill<span className={inverse ? "text-saffron" : "text-teal"}>Trace</span>
          </span>
          {showDescriptor && (
            <span className={cn("mt-1 block text-[9px] font-semibold uppercase tracking-[0.14em]", inverse ? "text-white/35" : "text-navy/35")}>
              Maharashtra outcome intelligence
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
