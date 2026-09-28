"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  Filter,
  Inbox,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { VerificationDrawer } from "@/components/employer/VerificationDrawer";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataSourceIndicator } from "@/components/ui/DataSourceIndicator";
import { StatCard } from "@/components/ui/StatCard";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { demoVerificationQueue } from "@/lib/demo-data";
import type { DataSourceState, VerificationQueueRow, VerificationStatus } from "@/lib/types";
import { formatDate, getInitials } from "@/lib/utils";

type StatusFilter = "all" | VerificationStatus;

function requestStatus(status: VerificationStatus) {
  if (status === "verified") return { label: "Verified", tone: "green" as const };
  if (status === "needs_correction") return { label: "Flagged", tone: "red" as const };
  return { label: "Pending", tone: "amber" as const };
}

function RequestStatus({ status }: { status: VerificationStatus }) {
  const config = requestStatus(status);
  return <Badge tone={config.tone} dot>{config.label}</Badge>;
}

function QueueTable({
  rows,
  onReview,
}: {
  rows: VerificationQueueRow[];
  onReview: (id: string) => void;
}) {
  if (!rows.length) {
    return (
      <div className="grid min-h-64 place-items-center p-8 text-center">
        <div>
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-navy-100 text-navy-500"><Search className="size-5" /></div>
          <p className="mt-4 text-sm font-extrabold text-navy-900">No matching requests</p>
          <p className="mt-1 text-xs text-navy-500">Try a different search or status filter.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <caption className="sr-only">Trainee employment verification requests</caption>
          <thead>
            <tr className="border-b border-navy-100 bg-soft-slate text-[9px] font-extrabold uppercase tracking-[0.13em] text-navy-400">
              <th scope="col" className="px-5 py-3.5">Trainee name</th>
              <th scope="col" className="px-4 py-3.5">Reported role</th>
              <th scope="col" className="px-4 py-3.5">Joining date</th>
              <th scope="col" className="px-4 py-3.5">Salary</th>
              <th scope="col" className="px-4 py-3.5">Status</th>
              <th scope="col" className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.employment_id}
                tabIndex={0}
                onClick={() => onReview(row.employment_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onReview(row.employment_id);
                  }
                }}
                aria-label={`Review ${row.trainee.name}, ${row.reported.role}`}
                className="cursor-pointer border-b border-navy-100 last:border-b-0 hover:bg-primary-50/30 focus-visible:bg-primary-50/40 focus-visible:outline-none"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-[10px] font-extrabold text-primary-700">{getInitials(row.trainee.name)}</div>
                    <div>
                      <p className="text-xs font-extrabold text-navy-900">{row.trainee.name}</p>
                      <p className="mt-1 font-mono text-[9px] text-navy-400">{row.trainee.internal_identifier}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p className="text-xs font-bold text-navy-800">{row.reported.role}</p>
                  <p className="mt-1 text-[10px] text-navy-400">{row.course.name}</p>
                </td>
                <td className="px-4 py-4 text-xs font-semibold text-navy-600">{formatDate(row.reported.start_date)}</td>
                <td className="px-4 py-4 text-xs font-extrabold text-navy-800">{row.reported.wage_band}</td>
                <td className="px-4 py-4"><RequestStatus status={row.status} /></td>
                <td className="px-5 py-4 text-right">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-navy-200 px-3 text-[10px] font-extrabold text-navy-700">
                    Review <ArrowRight className="size-3" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-navy-100 lg:hidden">
        {rows.map((row) => (
          <button key={row.employment_id} type="button" onClick={() => onReview(row.employment_id)} className="block w-full p-4 text-left transition hover:bg-primary-50/30 focus-visible:bg-primary-50/40 focus-visible:outline-none">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-[10px] font-extrabold text-primary-700">{getInitials(row.trainee.name)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-navy-900">{row.trainee.name}</p>
                    <p className="mt-0.5 text-[9px] text-navy-400">{row.trainee.internal_identifier}</p>
                  </div>
                  <RequestStatus status={row.status} />
                </div>
                <div className="mt-3 rounded-xl bg-soft-slate p-3">
                  <p className="text-xs font-extrabold text-navy-800">{row.reported.role}</p>
                  <p className="mt-1 text-[10px] text-navy-400">{row.course.name} · {row.reported.wage_band}</p>
                </div>
                <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold text-primary-600">Review request <ArrowRight className="size-3" /></p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

export function EmployerDashboard() {
  const router = useRouter();
  const { token, isDemoSession, user } = useAuth();
  const [queue, setQueue] = useState<VerificationQueueRow[]>(demoVerificationQueue);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [queueError, setQueueError] = useState<{ status: number } | null>(null);
  const [dataSource, setDataSource] = useState<DataSourceState>({
    source: "demo",
    lastUpdated: "2026-09-25T10:30:00.000Z",
    message: "Employer queue is interactive and saved locally in demo mode.",
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("skilltrace.employer-queue.v1");
      if (saved) {
        const parsed = JSON.parse(saved) as VerificationQueueRow[];
        if (Array.isArray(parsed) && parsed.length) setQueue(parsed);
      }
    } catch {
      // Retain the populated fallback when local storage is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("skilltrace.employer-queue.v1", JSON.stringify(queue));
  }, [queue, hydrated]);

  useEffect(() => {
    if (!token || isDemoSession || token.startsWith("demo-")) return;
    let active = true;
    console.debug("[EMPLOYER QUEUE] current user role:", user?.role ?? "unknown");
    setQueueError(null);
    api
      .getVerificationQueue(token)
      .then((data) => {
        if (!active || !Array.isArray(data) || !data.length) return;
        setQueue(data);
        setDataSource({ source: "live", lastUpdated: new Date().toISOString() });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        const status = caught instanceof ApiError ? caught.status : 0;
        console.debug("[EMPLOYER QUEUE] response status:", status);
        if (status === 403) setQueueError({ status });
        setDataSource({
          source: "demo",
          lastUpdated: "2026-09-25T10:30:00.000Z",
          message: "Live employer service is unavailable; the interactive local queue remains active.",
        });
      });
    return () => {
      active = false;
    };
  }, [token, isDemoSession, user?.role]);

  const rows = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return queue.filter((row) => {
      const matchesQuery = !normalised || [row.trainee.name, row.trainee.internal_identifier, row.reported.role, row.course.name, row.trainee.district].some((value) => value.toLowerCase().includes(normalised));
      return matchesQuery && (status === "all" || row.status === status);
    });
  }, [query, queue, status]);

  const selectedRow = selectedId ? queue.find((row) => row.employment_id === selectedId) ?? null : null;
  const pendingCount = queue.filter((row) => row.status === "pending").length;
  const verifiedCount = queue.filter((row) => row.status === "verified").length;
  const correctionCount = queue.filter((row) => row.status === "needs_correction").length;
  const confirmationRate = queue.length > 0 ? Math.round((verifiedCount / queue.length) * 100) : 0;
  const demandByCourse = useMemo(() => {
    const grouped = new Map<string, { course: string; sector: string; open: number; matched: number }>();
    for (const row of queue) {
      const entry = grouped.get(row.course.name) ?? { course: row.course.name, sector: row.course.sector, open: 0, matched: 0 };
      entry.matched += 1;
      if (row.status === "pending" || row.status === "needs_correction") entry.open += 1;
      grouped.set(row.course.name, entry);
    }
    return [...grouped.values()].sort((a, b) => b.open - a.open).slice(0, 4);
  }, [queue]);

  const updateStatus = (id: string, nextStatus: VerificationStatus) => {
    setQueue((current) => current.map((row) => row.employment_id === id ? { ...row, status: nextStatus, employer_confirmed: nextStatus === "verified" } : row));
    setDataSource((current) => ({ ...current, lastUpdated: new Date().toISOString() }));
  };

  return (
    <>
      <AppShell
        role="employer"
        title="Employer verification desk"
        subtitle="Review, verify and support trainee outcomes"
        headerActions={<div className="hidden lg:block"><DataSourceIndicator state={dataSource} /></div>}
      >
      {queueError?.status === 403 && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center" role="alert">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><ShieldCheck className="size-4" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-navy">This employer workspace needs an employer sign-in</p>
            <p className="mt-0.5 text-[11px] leading-4 text-navy/55">
              You are signed in as {user?.role === "admin" ? "government" : (user?.role ?? "an unknown role")}, so the verification queue returned 403 Forbidden. Showing demo data meanwhile.
            </p>
          </div>
          <Link href="/login?role=employer" className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-teal px-4 text-xs font-bold text-white transition hover:bg-[#086a66]">
            Sign in as employer <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
      <section className="relative overflow-hidden rounded-2xl bg-navy-900 p-5 text-white shadow-card sm:p-6">
        <div className="dark-grid absolute inset-0 opacity-35" />
        <div className="absolute -right-20 -top-28 size-80 rounded-full bg-primary-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-600 text-white"><ShieldCheck className="size-6" /></div>
            <div>
              <Badge className="bg-success-500/15 text-success-500 ring-success-500/20" dot>Verification portal active</Badge>
              <h1 className="mt-3 text-xl font-extrabold tracking-[-0.035em] sm:text-2xl">Welcome, {user?.name ?? "Neha Kulkarni"}</h1>
              <p className="mt-1 text-xs text-white/50">{user?.organization ? `Employer · ${user.organization}` : "HR Manager · ABC Manufacturing Pvt. Ltd."}</p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 sm:text-right">
            <p className="text-[9px] font-extrabold uppercase tracking-wider text-white/35">Review target</p>
            <p className="mt-1 text-sm font-extrabold text-white">Respond within 24 hours</p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total requests" value={String(queue.length)} detail="Current review cycle" icon={Inbox} tone="teal" />
        <StatCard label="Verified" value={String(verifiedCount)} detail="Employment confirmed" icon={UserRoundCheck} tone="green" />
        <StatCard label="Pending review" value={String(pendingCount + correctionCount)} detail={`${pendingCount} pending · ${correctionCount} flagged`} icon={AlertTriangle} tone="amber" />
        <StatCard label="Review target" value="≤20 min" detail="Median review target" icon={Clock3} tone="navy" className="col-span-2 lg:col-span-1" />
      </section>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-navy-100 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary-700"><FileSearch className="size-5" /></div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-navy-900">Verification request queue</h2>
                <p className="mt-0.5 text-[10px] text-navy-400">Showing {rows.length} of {queue.length} requests · Optimistic demo mutations enabled</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_190px] xl:w-auto xl:flex-1 xl:max-w-2xl">
              <label className="relative block">
                <span className="sr-only">Search trainee, role or ID</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy-300" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trainee, role or ID" className="h-11 w-full rounded-xl border border-navy-200 bg-white pl-9 pr-9 text-xs text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10" />
                {query && <button type="button" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-navy-400 hover:bg-navy-100" aria-label="Clear search"><X className="size-3.5" /></button>}
              </label>
              <label className="relative block">
                <span className="sr-only">Filter by status</span>
                <Filter className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-navy-300" />
                <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-11 w-full appearance-none rounded-xl border border-navy-200 bg-white pl-8 pr-3 text-xs font-bold text-navy-700 outline-none focus:border-primary-500">
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="needs_correction">Flagged</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <QueueTable rows={rows} onReview={(id) => router.push(`/employer/verify/${id}`)} />
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Employer analytics</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Your verification performance</h2>
          <p className="mt-1 text-[10px] text-navy-400">Derived live from your current queue — no estimates.</p>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            {[
              ["Candidates received", String(queue.length)],
              ["Confirmations", String(verifiedCount)],
              ["Pending confirmations", String(pendingCount + correctionCount)],
              ["Confirmation rate", `${confirmationRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-navy-100 bg-soft-slate px-3 py-2.5">
                <dt className="text-[8px] font-extrabold uppercase tracking-wider text-navy-400">{label}</dt>
                <dd className="mt-0.5 text-sm font-extrabold text-navy-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Skill demand</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Roles in your queue</h2>
            </div>
            <Badge tone="neutral" className="ml-auto">Illustrative values</Badge>
          </div>
          {demandByCourse.length === 0 ? (
            <p className="mt-4 text-xs font-bold text-navy-500" role="status">No queued roles yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {demandByCourse.map((item) => (
                <li key={item.course} className="flex items-center justify-between gap-3 rounded-xl border border-navy-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-navy-900">{item.course}</p>
                    <p className="mt-0.5 text-[9px] text-navy-400">{item.sector}</p>
                  </div>
                  <p className="shrink-0 text-[10px] font-bold text-navy-600">{item.open} open · {item.matched} matched</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section id="guide" className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-success-600"><CheckCircle2 className="size-5" /></div>
            <div>
              <h2 className="text-sm font-extrabold text-navy-900">Why your review matters</h2>
              <p className="mt-2 text-xs leading-6 text-navy-500">Confirming a role strengthens the trainee’s Outcome Passport and returns trusted skill feedback to training providers. It helps future cohorts learn what employers actually need.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Fairer hiring", "Better skill signals", "Stronger outcomes"].map((item) => <Badge key={item} tone="neutral">{item}</Badge>)}
              </div>
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-4 bg-primary-50 p-5 sm:p-6">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-600 text-white"><UsersRound className="size-5" /></div>
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-primary-700">Verification principle</p>
            <h2 className="mt-1 text-sm font-extrabold text-navy-900">Only confirm what you know</h2>
            <p className="mt-1 text-[10px] leading-5 text-navy-500">Private contact details and documents are never shown.</p>
          </div>
        </Card>
        </section>
      </AppShell>
      <VerificationDrawer
        row={selectedRow}
        open={Boolean(selectedRow)}
        onClose={() => setSelectedId(null)}
        onOptimistic={updateStatus}
        onRevert={(id, previous) => updateStatus(id, previous)}
      />
    </>
  );
}
