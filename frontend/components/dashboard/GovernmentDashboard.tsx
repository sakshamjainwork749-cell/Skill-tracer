"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarRange,
  CheckCircle2,
  Database,
  GraduationCap,
  IndianRupee,
  Lightbulb,
  ListChecks,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AttritionDonut, FunnelChart, OutcomeTrendChart, SkillGapBars } from "@/components/charts/ClientCharts";
import { DistrictMap } from "@/components/dashboard/DistrictMap";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataSourceIndicator } from "@/components/ui/DataSourceIndicator";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { demoDashboardData, formatIndianNumber } from "@/lib/demo-data";
import { findDistrictIdByName, getSkillGapSectors } from "@/lib/dashboard-utils";
import type { DataSourceState, DistrictOutcome } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ChartTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <details className="group mt-3 border-t border-navy-100 pt-3">
      <summary className="cursor-pointer list-none text-[10px] font-extrabold text-primary-600">View accessible data table</summary>
      <div className="mt-3 overflow-x-auto rounded-lg border border-navy-100">
        <table className="w-full border-collapse text-left text-[9px]">
          <thead className="bg-soft-slate text-navy-400">
            <tr>{headers.map((header) => <th key={header} className="px-2.5 py-2 font-extrabold">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-navy-100 text-navy-600">
            {rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell} className="px-2.5 py-2 font-bold">{value}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function GovernmentDashboard() {
  const { token, isDemoSession } = useAuth();
  const [data, setData] = useState(demoDashboardData);
  const [districtId, setDistrictId] = useState("all");
  const [skillSector, setSkillSector] = useState("");
  const [fromDate, setFromDate] = useState("2026-04-01");
  const [toDate, setToDate] = useState("2026-09-25");
  const [period, setPeriod] = useState("Last 12 months");
  const [lens, setLens] = useState("outcomes");
  const [districtQuery, setDistrictQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [employmentFilter, setEmploymentFilter] = useState("all");
  const [retentionFilter, setRetentionFilter] = useState("all");
  const [sortKey, setSortKey] = useState("trained");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [exportNotice, setExportNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [dataSource, setDataSource] = useState<DataSourceState>({
    source: "demo",
    lastUpdated: data.overview.updated_at,
    message: "Complete illustrative state dataset is active while the backend is offline.",
  });

  const periodParam = period === "Last 3 months" ? "3m" : period === "Last 6 months" ? "6m" : period === "Last 12 months" ? "12m" : undefined;

  // Crash-proof skill-gap access: never read sectors[0] without checking.
  const sectorSummaries = useMemo(() => getSkillGapSectors(data), [data]);
  const sector = sectorSummaries.find((item) => item.sector === skillSector) ?? sectorSummaries[0] ?? null;
  const activeSectorName = sector?.sector ?? "";

  useEffect(() => {
    if (!skillSector && sectorSummaries.length > 0) {
      setSkillSector(sectorSummaries[0].sector);
    }
  }, [skillSector, sectorSummaries]);

  useEffect(() => {
    if (!token || isDemoSession || token.startsWith("demo-")) return;
    let active = true;
    api
      .getDashboard({ district: districtId === "all" ? undefined : districtId, period: periodParam, startDate: fromDate || undefined, endDate: toDate || undefined }, token)
      .then((response) => {
        if (!active) return;
        setData(response);
        setDataSource({ source: "live", lastUpdated: response.overview.updated_at });
        const sectors = getSkillGapSectors(response);
        setSkillSector((current) =>
          sectors.some((item) => item.sector === current) ? current : (sectors[0]?.sector ?? ""),
        );
      })
      .catch(() => {
        if (active) {
          setDataSource({
            source: "demo",
            lastUpdated: demoDashboardData.overview.updated_at,
            message: "Live analytics service is unavailable; complete illustrative data remains active.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [districtId, periodParam, fromDate, toDate, token, isDemoSession]);

  const selectedDistrict = districtId === "all" ? null : data.districts.find((district) => district.id === districtId) ?? null;
  const activeDistrict = selectedDistrict ?? data.districts.find((district) => district.id === "pune") ?? data.districts[0];
  const kpis = useMemo(() => {
    if (!selectedDistrict) {
      return {
        trained: data.overview.total_trained,
        placed: data.overview.total_placed,
        employed: Math.round(data.overview.total_placed * (data.overview.employed_rate / 100)),
        employedRate: data.overview.employed_rate,
        retention: data.overview.retention_6m_rate,
        wage: data.overview.median_monthly_wage ?? 0,
      };
    }
    return {
      trained: selectedDistrict.trained,
      placed: selectedDistrict.placed,
      employed: Math.round(selectedDistrict.placed * (selectedDistrict.employed_rate / 100)),
      employedRate: selectedDistrict.employed_rate,
      retention: selectedDistrict.retention_6m_rate,
      wage: selectedDistrict.median_wage ?? 0,
    };
  }, [data.overview, selectedDistrict]);
  const largestGap = sector
    ? [...sector.skills].sort((a, b) => b.gap - a.gap || b.demand - a.demand)[0] ?? null
    : null;
  const highRiskDistricts = useMemo(
    () => data.districts.filter((district) => district.risk_level === "high"),
    [data.districts],
  );
  const totalPending = data.overview.pending_verification ?? 0;

  const comparisonRows = useMemo(() => {
    const filtered = data.districts.filter((district) => {
      if (riskFilter !== "all" && district.risk_level !== riskFilter) return false;
      if (employmentFilter !== "all" && district.employed_rate < Number(employmentFilter)) return false;
      if (retentionFilter !== "all" && district.retention_6m_rate < Number(retentionFilter)) return false;
      return true;
    });
    const valueOf = (district: DistrictOutcome) => {
      switch (sortKey) {
        case "placed": return district.placed;
        case "employment": return district.employed_rate;
        case "retention": return district.retention_6m_rate;
        case "wage": return district.median_wage ?? -1;
        default: return district.trained;
      }
    };
    return [...filtered].sort((a, b) => {
      const diff = valueOf(a) - valueOf(b);
      return sortDir === "asc" ? diff : -diff;
    });
  }, [data.districts, riskFilter, employmentFilter, retentionFilter, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const interventions = useMemo(() => {
    const items: string[] = [];
    const topGap = sectorSummaries
      .flatMap((item) => item.skills.map((skill) => ({ ...skill, sector: item.sector })))
      .sort((a, b) => b.gap - a.gap || b.demand - a.demand)[0];
    if (topGap) {
      items.push(
        `Increase ${topGap.sector} training capacity for "${topGap.skill}" (demand ${topGap.demand}, supply ${topGap.supply}).`,
      );
    }
    if (totalPending > 0) {
      items.push(
        `Prioritize employer outreach: ${formatIndianNumber(totalPending)} outcome${totalPending === 1 ? "" : "s"} awaiting verification.`,
      );
    }
    if (highRiskDistricts.length > 0) {
      items.push(
        `Monitor low-retention districts: ${highRiskDistricts.map((d) => d.name).join(", ")}.`,
      );
    }
    const lowRetention = data.districts.filter((d) => d.retention_6m_rate < 62);
    if (lowRetention.length > 0) {
      items.push(
        `Launch targeted re-skilling where 6M retention trails below 62% (${lowRetention.map((d) => d.name).slice(0, 3).join(", ")}).`,
      );
    }
    items.push("Increase apprenticeship and employer partnerships to convert placements into retained employment.");
    return items;
  }, [sectorSummaries, totalPending, highRiskDistricts, data.districts]);

  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  // Reporting lens: outcomes ranks districts by employment, verification lens
  // ranks by six-month retention risk (lowest retention first).
  const visibleDistricts = useMemo(() => {
    const query = districtQuery.trim().toLowerCase();
    const filtered = query
      ? data.districts.filter((district) => district.name.toLowerCase().includes(query))
      : [...data.districts];
    filtered.sort((a, b) => lens === "verification"
      ? a.retention_6m_rate - b.retention_6m_rate
      : b.employed_rate - a.employed_rate);
    return filtered;
  }, [data.districts, districtQuery, lens]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportParams = () => ({
    district: districtId === "all" ? undefined : activeDistrict?.name ?? districtId,
    period: periodParam,
    startDate: fromDate || undefined,
    endDate: toDate || undefined,
    lens,
  });

  const exportReport = async (format: "csv" | "pdf") => {
    if (exporting) return;
    setExporting(format);
    setExportNotice(null);
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      const isLive = token && !token.startsWith("demo-");
      if (isLive) {
        const { blob, filename } = await api.exportReport({ ...exportParams(), format }, token);
        downloadBlob(blob, filename || `skilltrace_outcome_report_${stamp}.${format}`);
      } else {
        // Demo/offline snapshot of the currently displayed dataset.
        if (format === "pdf") {
          throw new Error("PDF export needs the live backend. Sign in as government admin.");
        }
        const headings = ["District", "Trained", "Placed", "Employment Rate", "6M Retention", "Self Employment", "Median Wage"];
        const rows = visibleDistricts.map((district) => [district.name, district.trained, district.placed, `${district.employed_rate}%`, `${district.retention_6m_rate}%`, `${district.self_employment_rate}%`, district.median_wage]);
        const csv = [headings, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
        downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `skilltrace_outcome_report_${stamp}.csv`);
      }
      setExportNotice({ tone: "ok", text: `${format.toUpperCase()} report downloaded with the current filters.` });
    } catch (caught) {
      setExportNotice({
        tone: "err",
        text: caught instanceof Error ? caught.message : "Export failed. Please try again.",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <AppShell
        role="admin"
        title="Government & Administrator Dashboard"
        subtitle="Maharashtra skill outcomes and policy intelligence"
        headerActions={
          <div className="hidden items-center gap-3 lg:flex">
            <DataSourceIndicator state={dataSource} />
            <Button onClick={() => void exportReport("csv")} disabled={exporting !== null}><ArrowDownToLine className="size-4" /> {exporting === "csv" ? "Exporting CSV…" : "Export CSV"}</Button>
            <Button onClick={() => void exportReport("pdf")} disabled={exporting !== null} variant="secondary"><ArrowDownToLine className="size-4" /> {exporting === "pdf" ? "Exporting PDF…" : "Export PDF"}</Button>
          </div>
        }
      >
      <section id="reports" className="flex scroll-mt-24 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue" dot>Maharashtra</Badge>
            <Badge tone="neutral">Decision support prototype</Badge>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.04em] text-navy-900 sm:text-3xl">Outcome intelligence for every district.</h1>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-navy-500 sm:text-sm">Track how training becomes placement, retention and wage growth—and use skill-gap signals to improve the next cohort.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row xl:hidden">
          <Button onClick={() => void exportReport("csv")} disabled={exporting !== null} className="w-fit"><ArrowDownToLine className="size-4" /> {exporting === "csv" ? "Exporting CSV…" : "Export CSV"}</Button>
          <Button onClick={() => void exportReport("pdf")} disabled={exporting !== null} variant="secondary" className="w-fit"><ArrowDownToLine className="size-4" /> {exporting === "pdf" ? "Exporting PDF…" : "Export PDF"}</Button>
        </div>
        {exportNotice && (
          <p
            role="status"
            className={exportNotice.tone === "ok"
              ? "mt-3 w-fit rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800"
              : "mt-3 w-fit rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700"}
          >
            {exportNotice.text}
          </p>
        )}
      </section>

      <Card className="mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary-700"><CalendarRange className="size-5" /></div>
            <div>
              <h2 className="text-sm font-extrabold text-navy-900">Outcome scope</h2>
              <p className="mt-0.5 text-[10px] text-navy-400">Filter the dashboard by geography, period or course.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[720px]">
            <label>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">District</span>
              <select value={districtId} onChange={(event) => setDistrictId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-xs font-bold text-navy-800 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10">
                <option value="all">All Maharashtra</option>
                {data.districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
              </select>
            </label>
            <label>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">Period</span>
              <select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-xs font-bold text-navy-800 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10">
                <option>Last 3 months</option><option>Last 6 months</option><option>Last 12 months</option><option>Current cohort</option>
              </select>
            </label>
            <label>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">Reporting lens</span>
              <select value={lens} onChange={(event) => setLens(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-xs font-bold text-navy-800 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10" aria-label="Reporting lens">
                <option value="outcomes">Outcome outcomes</option>
                <option value="verification">Verification quality</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[480px]">
            <label>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">From date</span>
              <input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-xs font-bold text-navy-800 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10" />
            </label>
            <label>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">To date</span>
              <input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-xs font-bold text-navy-800 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10" />
            </label>
          </div>
        </div>
      </Card>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Trained" value={formatIndianNumber(kpis.trained)} detail={selectedDistrict ? selectedDistrict.name : "Current reporting cohort"} icon={GraduationCap} tone="blue" />
        <StatCard label="Placed" value={formatIndianNumber(kpis.placed)} detail={`${((kpis.placed / kpis.trained) * 100).toFixed(1)}% placement yield`} icon={BriefcaseBusiness} tone="navy" />
        <StatCard label="Currently employed rate" value={`${kpis.employedRate}%`} detail={`${formatIndianNumber(kpis.employed)} people in verified work`} icon={Activity} tone="green" />
        <StatCard label="6M retention rate" value={`${kpis.retention}%`} detail="Employed at six months" icon={Target} tone="amber" />
        <StatCard label="Median monthly wage" value={`₹${formatIndianNumber(kpis.wage)}`} detail="Among verified placements" icon={IndianRupee} tone="blue" className="col-span-2 md:col-span-1" />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Self-employed" value={formatIndianNumber(data.overview.self_employed ?? 0)} detail="Independent livelihoods" icon={UsersRound} tone="teal" />
        <StatCard label="Pending verification" value={formatIndianNumber(totalPending)} detail="Awaiting employer confirmation" icon={ListChecks} tone="amber" />
        <StatCard label="High-risk districts" value={String(highRiskDistricts.length)} detail={highRiskDistricts.length ? highRiskDistricts.map((d) => d.name).slice(0, 3).join(", ") : "No high-risk districts"} icon={AlertTriangle} tone="red" />
        <StatCard label="Training completed" value={formatIndianNumber(data.overview.training_completed ?? data.overview.total_trained)} detail="Certified completions in scope" icon={CheckCircle2} tone="green" />
      </section>

      <Card id="districts" className="mt-5 overflow-hidden scroll-mt-24">
        <div className="flex flex-col gap-3 border-b border-navy-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary-700"><MapPinned className="size-5" /></div>
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Maharashtra district outcomes</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Regional outcome pulse</h2>
            </div>
          </div>
          <Badge tone="neutral">{data.districts.length} districts in dataset</Badge>
        </div>
        <div className="p-4 sm:p-6">
          <DistrictMap districts={visibleDistricts} selectedId={districtId === "all" ? "all" : (activeDistrict?.id ?? "all")} onSelect={setDistrictId} query={districtQuery} onQueryChange={setDistrictQuery} />
        </div>
        <div className="border-t border-navy-100 bg-soft-slate p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-navy-400">Selected region</p>
              <h3 className="mt-1 text-lg font-extrabold text-navy-900">{districtId === "all" ? "All Maharashtra" : (activeDistrict?.name ?? "Select a district")}</h3>
              <p className="mt-1 text-[10px] text-navy-500">Representative district metrics shown on the map and table.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ["Trained", formatIndianNumber(activeDistrict?.trained ?? 0)],
                ["Placed", formatIndianNumber(activeDistrict?.placed ?? 0)],
                ["Employment", `${activeDistrict?.employed_rate ?? 0}%`],
                ["6M retained", `${activeDistrict?.retention_6m_rate ?? 0}%`],
                ["Self-employed", `${activeDistrict?.self_employment_rate ?? 0}%`],
                ["Median wage", activeDistrict?.median_wage ? `₹${formatIndianNumber(activeDistrict.median_wage)}` : "No data"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-navy-100 bg-white px-3 py-3">
                  <p className="text-[8px] font-extrabold uppercase tracking-wider text-navy-400">{label}</p>
                  <p className="mt-1 text-sm font-extrabold text-navy-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-2 rounded-2xl border border-navy-100 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-[8px] font-extrabold uppercase tracking-wider text-navy-400">Verification</p>
              <p className="mt-1 text-sm font-extrabold text-navy-900">{formatIndianNumber(activeDistrict?.pending_verification ?? 0)} pending</p>
              <p className="mt-0.5 text-[9px] text-navy-400">{(activeDistrict?.pending_verification ?? 0) > 0 ? "Awaiting employer confirmation" : "Queue clear for this district"}</p>
            </div>
            <div>
              <p className="text-[8px] font-extrabold uppercase tracking-wider text-navy-400">Follow-up due</p>
              <p className="mt-1 text-sm font-extrabold text-navy-900">{formatIndianNumber(activeDistrict?.followup_due ?? 0)} due</p>
              <p className="mt-0.5 text-[9px] text-navy-400">Check-ins due within 30 days</p>
            </div>
            <div>
              <p className="text-[8px] font-extrabold uppercase tracking-wider text-navy-400">Outcome risk</p>
              <p className="mt-1 text-sm font-extrabold capitalize text-navy-900">{activeDistrict?.risk_level ?? "—"}</p>
              <p className="mt-0.5 text-[9px] text-navy-400">Composite retention, wage & verification signals</p>
            </div>
            <div>
              <p className="text-[8px] font-extrabold uppercase tracking-wider text-navy-400">Top state-wide skill gap</p>
              <p className="mt-1 text-sm font-extrabold text-navy-900">{sector ? `${sector.topSkill} (${sector.sector})` : "No skill-gap data"}</p>
              <p className="mt-0.5 text-[9px] text-navy-400">{sector ? `Shortfall of ${sector.gap} against employer demand` : "Available once demand signals load"}</p>
            </div>
          </div>
          {activeDistrict && districtId !== "all" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/dashboard/outreach?tab=trainees&district=${encodeURIComponent(activeDistrict.name)}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-navy-200 bg-white px-4 text-xs font-bold text-navy transition hover:border-primary-300"
              >
                View trainees <ArrowDownToLine className="size-3.5 rotate-90" />
              </Link>
              <Link
                href={`/dashboard/outreach?tab=campaigns&district=${encodeURIComponent(activeDistrict.name)}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary-600 px-4 text-xs font-bold text-white transition hover:bg-primary-700"
              >
                Create follow-up campaign <ArrowDownToLine className="size-3.5 rotate-90" />
              </Link>
            </div>
          )}
          {activeDistrict && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-saffron/20 bg-saffron-soft/55 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8C510C]">Top outcome risks</p>
                  <Badge tone={activeDistrict.risk_level === "high" ? "red" : activeDistrict.risk_level === "moderate" ? "amber" : "green"}>{activeDistrict.risk_level} risk</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeDistrict.top_risk_drivers.map((driver) => <Badge key={driver} tone="amber">{driver}</Badge>)}
                </div>
              </div>
              <p className="max-w-sm text-[10px] leading-5 text-navy-500">
                {activeDistrict.risk_level === "high"
                  ? "Prioritise mobility support, local employer partnerships and multilingual placement guidance."
                  : "Sustain placement volume while strengthening contract renewal checks and role-specific upskilling."}
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Conversion pathway</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Training-to-employment funnel</h2>
              <p className="mt-1 text-[10px] text-navy-400">Where cohorts grow—and where they narrow.</p>
            </div>
            <Badge tone="green"><TrendingUp className="size-3" /> 12-month retention</Badge>
          </div>
          <div className="mt-3"><FunnelChart data={data.funnel.stages} /></div>
          <ChartTable headers={["Stage", "People", "Of enrolled"]} rows={data.funnel.stages.map((stage) => [stage.name, stage.value.toLocaleString("en-IN"), `${stage.percentage}%`])} />
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Outcome trend</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Placement, employment & retention</h2>
              <p className="mt-1 text-[10px] text-navy-400">Six-month cohort performance trend.</p>
            </div>
            <Badge tone="blue">Apr–Sep 2026</Badge>
          </div>
          <div className="mt-3"><OutcomeTrendChart data={data.overview.trend} /></div>
          <ChartTable headers={["Month", "Placement", "Employment", "6M retention"]} rows={data.overview.trend.map((point) => [point.label, point.placement_rate == null ? "—" : `${point.placement_rate}%`, `${point.employed_rate}%`, point.retention_6m_rate == null ? "—" : `${point.retention_6m_rate}%`])} />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Attrition signals</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Top reasons for leaving work</h2>
              <p className="mt-1 text-[10px] text-navy-400">Verified exit-check responses.</p>
            </div>
            <Badge tone="amber">Top 5 reasons</Badge>
          </div>
          <div className="mt-1"><AttritionDonut data={data.attrition} /></div>
          <div className="space-y-2">
            {data.attrition.reasons.map((reason, index) => (
              <div key={reason.reason} className="flex items-center justify-between gap-3 text-[10px]">
                <span className="flex items-center gap-2 font-bold text-navy-600"><span className={cn("size-2 rounded-full", index === 0 ? "bg-primary-600" : index === 1 ? "bg-warning-500" : index === 2 ? "bg-success-500" : "bg-navy-300")} />{reason.reason}</span>
                <span className="font-extrabold text-navy-900">{reason.percentage}%</span>
              </div>
            ))}
          </div>
          <ChartTable headers={["Reason", "Count", "Share"]} rows={data.attrition.reasons.map((reason) => [reason.reason, reason.count.toLocaleString("en-IN"), `${reason.percentage}%`])} />
        </Card>

        <Card id="skill-gaps" className="scroll-mt-24 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Skill gap intelligence</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Skill Supply vs Demand</h2>
              <p className="mt-1 text-[10px] text-navy-400">Trained supply compared with employer demand signals.</p>
              <Badge tone="neutral" className="mt-2">Illustrative employer demand</Badge>
            </div>
            <select
              value={activeSectorName}
              onChange={(event) => setSkillSector(event.target.value)}
              disabled={sectorSummaries.length === 0}
              className="h-10 rounded-xl border border-navy-200 bg-white px-3 text-[10px] font-extrabold text-navy-700 outline-none focus:border-primary-500 disabled:opacity-50"
              aria-label="Skill sector"
            >
              {sectorSummaries.map((item) => <option key={item.sector} value={item.sector}>{item.sector}</option>)}
            </select>
          </div>
          {sector ? (
            <>
              <div className="mt-3"><SkillGapBars sector={{ sector: sector.sector, skills: sector.skills }} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Sector supply", formatIndianNumber(sector.supply)],
                  ["Employer demand", formatIndianNumber(sector.demand)],
                  ["Skill gap", formatIndianNumber(sector.gap)],
                  ["Gap", `${sector.gapPct}%`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-navy-100 bg-soft-slate px-3 py-2.5">
                    <p className="text-[8px] font-extrabold uppercase tracking-wider text-navy-400">{label}</p>
                    <p className="mt-0.5 text-sm font-extrabold text-navy-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 p-3.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning-500 text-navy-900"><Lightbulb className="size-4" /></div>
                <div>
                  <p className="text-[10px] font-extrabold text-navy-900">Largest gap: {largestGap?.skill ?? "—"}</p>
                  <p className="mt-0.5 text-[9px] text-navy-500">Supply {largestGap?.supply ?? "—"} vs demand {largestGap?.demand ?? "—"} · {largestGap?.gap ?? 0}-point shortfall</p>
                </div>
              </div>
              <ChartTable headers={["Skill", "Supply", "Demand", "Gap"]} rows={sector.skills.map((skill) => [skill.skill, skill.supply, skill.demand, skill.gap])} />
            </>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-navy-200 p-6 text-center text-xs font-bold text-navy-500" role="status">
              No skill-gap data available for the selected filters.
            </p>
          )}
        </Card>
      </div>

      <section id="insights" className="mt-5 scroll-mt-24">        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-navy-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary-700"><BrainCircuit className="size-5" /></div>
              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">AI insights & policy alerts</p>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Signals that point to a practical next step</h2>
              </div>
            </div>
            <Badge tone="neutral">Evidence-linked summaries</Badge>
          </div>
          <div className="grid divide-y divide-navy-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            {data.insights.insights.map((insight) => {
              const districtTarget = findDistrictIdByName(data, insight.district);
              const sectorTarget = sectorSummaries.some((item) => item.sector.toLowerCase() === (insight.sector ?? "").toLowerCase())
                ? insight.sector
                : null;
              return (
              <article key={insight.id} className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", insight.severity === "opportunity" ? "bg-success-50 text-success-600" : insight.severity === "critical" ? "bg-red-50 text-coral" : "bg-warning-50 text-warning-700")}>
                    {insight.severity === "opportunity" ? <Sparkles className="size-5" /> : <AlertTriangle className="size-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={insight.severity === "opportunity" ? "green" : insight.severity === "critical" ? "red" : "amber"}>{insight.severity}</Badge>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-navy-400">{insight.district} · {insight.sector}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-extrabold leading-6 text-navy-900">{insight.title}</h3>
                    <p className="mt-2 text-[11px] leading-5 text-navy-500">{insight.summary}</p>
                    <Badge tone="neutral" className="mt-3">{insight.metric}</Badge>
                    {(districtTarget || sectorTarget) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {districtTarget && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setDistrictId(districtTarget); scrollToSection("districts"); }}
                          >
                            View {insight.district} outcomes <ArrowDownToLine className="size-3 rotate-90" />
                          </Button>
                        )}
                        {sectorTarget && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSkillSector(sectorTarget as string); scrollToSection("skill-gaps"); }}
                          >
                            View {sectorTarget} skill gap <ArrowDownToLine className="size-3 rotate-90" />
                          </Button>
                        )}
                      </div>
                    )}
                    <details className="group mt-4 rounded-xl border border-navy-100 bg-soft-slate p-4">
                      <summary className="cursor-pointer list-none text-[10px] font-extrabold text-primary-600">Why this insight?</summary>
                      <p className="mt-3 text-[10px] leading-5 text-navy-500"><strong className="text-navy-800">Evidence:</strong> {insight.evidence}</p>
                      <p className="mt-3 text-[10px] leading-5 text-navy-500"><strong className="text-navy-800">Recommended action:</strong> {insight.recommendation}</p>
                    </details>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </Card>
      </section>

      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-navy-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary-700"><ListChecks className="size-5" /></div>
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">District comparison</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Every district, side by side</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">Risk</span>
              <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-navy-200 bg-white px-2 text-[11px] font-bold text-navy-800 outline-none focus:border-primary-500">
                <option value="all">All risks</option>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">Employment ≥</span>
              <select value={employmentFilter} onChange={(event) => setEmploymentFilter(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-navy-200 bg-white px-2 text-[11px] font-bold text-navy-800 outline-none focus:border-primary-500">
                <option value="all">Any</option>
                <option value="80">80%</option>
                <option value="70">70%</option>
                <option value="60">60%</option>
              </select>
            </label>
            <label>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">Retention ≥</span>
              <select value={retentionFilter} onChange={(event) => setRetentionFilter(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-navy-200 bg-white px-2 text-[11px] font-bold text-navy-800 outline-none focus:border-primary-500">
                <option value="all">Any</option>
                <option value="70">70%</option>
                <option value="65">65%</option>
                <option value="60">60%</option>
              </select>
            </label>
            <label>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">Sort</span>
              <select value={`${sortKey}:${sortDir}`} onChange={(event) => { const [key, dir] = event.target.value.split(":"); setSortKey(key); setSortDir(dir as "asc" | "desc"); }} className="mt-1 h-10 w-full rounded-xl border border-navy-200 bg-white px-2 text-[11px] font-bold text-navy-800 outline-none focus:border-primary-500">
                <option value="trained:desc">Trained ↓</option>
                <option value="placed:desc">Placed ↓</option>
                <option value="employment:desc">Employment ↓</option>
                <option value="retention:desc">Retention ↓</option>
                <option value="wage:desc">Wage ↓</option>
              </select>
            </label>
          </div>
        </div>
        {comparisonRows.length === 0 ? (
          <p className="p-6 text-center text-xs font-bold text-navy-500" role="status">No records available for the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <caption className="sr-only">District comparison with filters</caption>
              <thead>
                <tr className="bg-soft-slate text-[8px] font-extrabold uppercase tracking-[0.1em] text-navy-400">
                  {([["District", null], ["Trained", "trained"], ["Placed", "placed"], ["Employment", "employment"], ["6M Retention", "retention"], ["Self-employed", null], ["Median Wage", "wage"], ["Risk", null]] as Array<[string, string | null]>).map(([label, key]) => (
                    <th key={label} scope="col" className="px-3 py-3 text-right first:text-left">
                      {key ? (
                        <button type="button" onClick={() => toggleSort(key)} className="font-extrabold hover:text-primary-600" aria-label={`Sort by ${label}`}>
                          {label} {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      ) : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {comparisonRows.map((district) => (
                  <tr
                    key={district.id}
                    onClick={() => setDistrictId(district.id)}
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDistrictId(district.id); } }}
                    className={cn("cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500", districtId === district.id ? "bg-primary-50" : "hover:bg-soft-slate")}
                  >
                    <td className="px-3 py-3 text-[11px] font-extrabold text-navy-900">{district.name}</td>
                    <td className="px-3 py-3 text-right text-[11px] font-bold text-navy-600">{district.trained.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-3 text-right text-[11px] font-bold text-navy-600">{district.placed.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-3 text-right text-[11px] font-extrabold text-navy-800">{district.employed_rate}%</td>
                    <td className="px-3 py-3 text-right text-[11px] font-extrabold text-navy-800">{district.retention_6m_rate}%</td>
                    <td className="px-3 py-3 text-right text-[11px] font-bold text-navy-600">{district.self_employment_rate}%</td>
                    <td className="px-3 py-3 text-right text-[11px] font-bold text-navy-600">{district.median_wage ? `₹${formatIndianNumber(district.median_wage)}` : "—"}</td>
                    <td className="px-3 py-3 text-right"><Badge tone={district.risk_level === "high" ? "red" : district.risk_level === "moderate" ? "amber" : "green"}>{district.risk_level}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-warning-50 text-warning-700"><Wrench className="size-5" /></div>
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-warning-700">Recommended interventions</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Where to act next</h2>
            </div>
          </div>
          <Badge tone="neutral" className="mt-3">System-generated recommendations</Badge>
          <ul className="mt-4 space-y-2.5">
            {interventions.map((item) => (
              <li key={item} className="flex items-start gap-2.5 rounded-xl border border-navy-100 bg-soft-slate p-3 text-[11px] leading-5 text-navy-700">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success-600" /> {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary-700"><Database className="size-5" /></div>
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Data quality & coverage</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">How complete is the evidence?</h2>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            {[
              ["Districts with data", String(data.districts.length)],
              ["Records awaiting verification", formatIndianNumber(totalPending)],
              ["Districts missing wage data", String(data.districts.filter((d) => d.median_wage == null).length)],
              ["Last data refresh", dataSource.lastUpdated ? new Date(dataSource.lastUpdated).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-navy-100 p-3">
                <dt className="text-[8px] font-extrabold uppercase tracking-wider text-navy-400">{label}</dt>
                <dd className="mt-1 text-sm font-extrabold text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[10px] leading-5 text-navy-500">Per-record consent is enforced by the API: employer queues exclude trainees without consent, and exports contain aggregates only.</p>
        </Card>
      </div>

      <Card className="mt-5 border-navy-800 bg-navy-900 p-5 text-white sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-primary-300"><ShieldCheck className="size-5" /></div>
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-300">Methodology & confidence</p>
              <h2 className="mt-1 text-sm font-extrabold">How to read this dashboard</h2>
              <p className="mt-2 max-w-4xl text-[10px] leading-5 text-white/45">Rates combine verified training completions, consented trainee updates and authorised employer confirmations. AI-assisted summaries are decision prompts grounded in the same metrics shown here—not causal claims.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-success-500/15 text-success-500 ring-success-500/20" dot>High coverage</Badge>
            <Badge className="bg-white/10 text-white/70 ring-white/10">24h refresh</Badge>
            <Badge className="bg-white/10 text-white/70 ring-white/10">Consent protected</Badge>
          </div>
        </div>
      </Card>

      <div className="mt-4 flex flex-col gap-2 text-[9px] text-navy-400 sm:flex-row sm:items-center sm:justify-between">
        <p>{selectedDistrict?.name ?? "Maharashtra"} · {period} · {dataSource.source === "live" ? "Live API data" : "Illustrative demo data"}</p>
        <p className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3" /> Last updated {formatDateTime(dataSource.lastUpdated)}</p>
        </div>
      </AppShell>
    </>
  );
}
