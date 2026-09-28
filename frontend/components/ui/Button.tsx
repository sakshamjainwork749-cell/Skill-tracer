import { forwardRef, type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-teal text-white shadow-sm hover:bg-teal-700 focus-visible:ring-teal/25 disabled:bg-teal/50",
  secondary:
    "bg-saffron text-navy shadow-sm hover:bg-saffron-500 focus-visible:ring-saffron/25",
  outline:
    "border border-navy/15 bg-white/70 text-navy hover:border-teal/40 hover:bg-teal-soft/50 focus-visible:ring-teal/20",
  ghost: "text-navy hover:bg-navy/5 focus-visible:ring-navy/10",
  danger: "bg-coral text-white hover:bg-red-700 focus-visible:ring-coral/25",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/25",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 rounded-xl px-3.5 text-sm",
  md: "h-11 rounded-xl px-4 text-sm",
  lg: "h-12 rounded-2xl px-5 text-[15px]",
  icon: "size-10 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
