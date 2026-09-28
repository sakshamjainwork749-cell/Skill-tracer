"use client";

import dynamic from "next/dynamic";

function ChartLoading({ height = "h-72" }: { height?: string }) {
  return (
    <div className={`${height} grid animate-pulse place-items-center rounded-xl bg-navy-50`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-navy-400">
        <span className="size-4 animate-spin rounded-full border-2 border-primary-100 border-t-primary-600" />
        Preparing accessible chart…
      </div>
    </div>
  );
}

export const OutcomeTrendChart = dynamic(
  () => import("./DashboardCharts").then((module) => module.OutcomeTrendChart),
  { ssr: false, loading: () => <ChartLoading /> },
);

export const FunnelChart = dynamic(
  () => import("./DashboardCharts").then((module) => module.FunnelChart),
  { ssr: false, loading: () => <ChartLoading height="h-[300px]" /> },
);

export const SkillGapBars = dynamic(
  () => import("./DashboardCharts").then((module) => module.SkillGapBars),
  { ssr: false, loading: () => <ChartLoading height="h-[330px]" /> },
);

export const AttritionDonut = dynamic(
  () => import("./DashboardCharts").then((module) => module.AttritionDonut),
  { ssr: false, loading: () => <ChartLoading height="h-[270px]" /> },
);
