import { Cloud, Database, RefreshCw } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import type { DataSourceState } from "@/lib/types";

export function DataSourceIndicator({
  state,
  className,
  compact = false,
}: {
  state: DataSourceState;
  className?: string;
  compact?: boolean;
}) {
  const live = state.source === "live";
  const Icon = live ? Cloud : Database;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold",
        live
          ? "border-emerald-600/15 bg-emerald-50 text-emerald-800"
          : "border-saffron/25 bg-saffron-soft/70 text-[#80500F]",
        className,
      )}
      title={state.message}
    >
      {live ? (
        <RefreshCw className="size-3.5" aria-hidden="true" />
      ) : (
        <Icon className="size-3.5" aria-hidden="true" />
      )}
      <span>{live ? "Live data" : "Demo dataset"}</span>
      {!compact && (
        <>
          <span className="h-3 w-px bg-current opacity-20" />
          <time dateTime={state.lastUpdated}>{formatDateTime(state.lastUpdated)}</time>
        </>
      )}
    </div>
  );
}
