"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Megaphone,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  UsersRound,
  Wand2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataSourceIndicator } from "@/components/ui/DataSourceIndicator";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type {
  AudienceFilter,
  Automation,
  Campaign,
  DataSourceState,
  MessageTemplate,
  OutreachAnalytics,
  TraineeOutreachRow,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "overview" | "campaigns" | "automations" | "templates" | "trainees";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "campaigns", label: "Campaigns" },
  { id: "automations", label: "Automations" },
  { id: "templates", label: "Templates" },
  { id: "trainees", label: "Trainees" },
];

function audienceSummary(filter: Record<string, unknown> | null): string {
  if (!filter) return "All trainees";
  const parts: string[] = [];
  if (typeof filter.district === "string" && filter.district) parts.push(filter.district);
  if (typeof filter.employment_status === "string" && filter.employment_status) parts.push(filter.employment_status);
  if (filter.followup_due) parts.push("follow-up due");
  if (filter.consent_given) parts.push("opted-in");
  if (Array.isArray(filter.trainee_ids)) parts.push(`${filter.trainee_ids.length} selected`);
  return parts.length ? parts.join(" · ") : "All trainees";
}

export function OutreachDashboard() {
  return (
    <Suspense fallback={<p className="p-6 text-xs text-navy-400">Loading outreach…</p>}>
      <OutreachContent />
    </Suspense>
  );
}

function OutreachContent() {
  const { token, isDemoSession } = useAuth();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const requested = searchParams.get("tab");
    return tabs.some((t) => t.id === requested) ? (requested as Tab) : "overview";
  });
  const [analytics, setAnalytics] = useState<OutreachAnalytics | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const isLive = Boolean(token && !isDemoSession && !token.startsWith("demo-"));
  const [dataSource] = useState<DataSourceState>({
    source: "demo",
    lastUpdated: new Date().toISOString(),
    message: "Outreach requires a live government admin session.",
  });

  const refresh = useCallback(async () => {
    if (!isLive) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [a, c, r, t] = await Promise.all([
        api.getOutreachAnalytics(token),
        api.getCampaigns(token),
        api.getAutomations(token),
        api.getMessageTemplates(token),
      ]);
      setAnalytics(a);
      setCampaigns(c);
      setAutomations(r);
      setTemplates(t);
    } catch {
      setError("Unable to load outreach data. Check the backend connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [token, isLive]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runScheduler = async () => {
    setBusy(true);
    setNotice("");
    try {
      const result = await api.runSchedulerNow(token);
      setNotice(`Scheduler run: ${result.started} campaigns started, ${result.sent} sent, ${result.failed} failed. Statuses persist in the database.`);
      await refresh();
    } catch {
      setNotice("Scheduler run failed. Please retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      role="admin"
      title="Outreach & Automation"
      subtitle="Consent-based trainee messaging at population scale"
      headerActions={
        <div className="hidden items-center gap-3 lg:flex">
          <DataSourceIndicator state={isLive ? { source: "live", lastUpdated: new Date().toISOString() } : dataSource} />
          <Button size="sm" variant="outline" onClick={() => void runScheduler()} disabled={busy || !isLive}>
            <Play className="size-3.5" /> Run scheduler now
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Outreach sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "h-10 rounded-xl px-4 text-xs font-extrabold transition",
              tab === item.id ? "bg-navy-900 text-white shadow-sm" : "border border-navy-200 bg-white text-navy-600 hover:border-primary-300",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] leading-5 text-emerald-900">
        Only trainees who have opted in to WhatsApp follow-up can receive automated messages. Consent is
        re-checked at send time; revocation cancels future messages. Demo runs are labelled SIMULATED.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700" role="alert">{error}</p>
      )}
      {notice && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800" role="status">{notice}</p>
      )}

      {!isLive && !loading && (
        <p className="mt-4 rounded-xl bg-soft-slate p-4 text-xs leading-5 text-navy-500">
          Sign in as government admin to manage live outreach. The sections below need backend data.
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-xs text-navy-400" role="status">Loading outreach…</p>
      ) : (
        <div className="mt-5">
          {tab === "overview" && analytics && <OverviewTab analytics={analytics} automations={automations} />}
          {tab === "campaigns" && (
            <CampaignsTab
              campaigns={campaigns}
              templates={templates}
              token={token}
              isLive={isLive}
              initialDistrict={searchParams.get("district") ?? ""}
              onChanged={refresh}
              onNotice={setNotice}
            />
          )}
          {tab === "automations" && (
            <AutomationsTab automations={automations} templates={templates} token={token} isLive={isLive} onChanged={refresh} />
          )}
          {tab === "templates" && (
            <TemplatesTab templates={templates} token={token} isLive={isLive} onChanged={refresh} />
          )}
          {tab === "trainees" && (
            <TraineesTab token={token} isLive={isLive} templates={templates} initialDistrict={searchParams.get("district") ?? ""} onNotice={setNotice} onChanged={refresh} />
          )}
        </div>
      )}
    </AppShell>
  );
}

function OverviewTab({ analytics, automations }: { analytics: OutreachAnalytics; automations: Automation[] }) {
  const active = automations.find((rule) => rule.is_active) ?? automations[0] ?? null;
  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Active automations" value={String(analytics.active_automations)} detail={`${analytics.total_automations} total rules`} icon={Wand2} tone="teal" />
        <StatCard label="Messages scheduled" value={String(analytics.messages_scheduled)} detail={`${analytics.enrolled} trainees enrolled`} icon={Send} tone="blue" />
        <StatCard label="Delivered" value={String(analytics.delivered)} detail={`${analytics.simulated} simulated`} icon={CheckCircle2} tone="green" />
        <StatCard label="Pending" value={String(analytics.pending)} detail="Queued + processing" icon={Megaphone} tone="amber" />
        <StatCard label="Failed" value={String(analytics.failed)} detail="Needs attention" icon={X} tone="red" />
      </section>

      {active && (
        <Card className="mt-5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Active automation</p>
              <h2 className="mt-1 text-lg font-extrabold text-navy-900">{active.name}</h2>
              <p className="mt-1 text-[11px] text-navy-500">
                {active.delay_days.map((d) => `${d}-day`).join(" / ")} check-ins · {active.enrolled} trainees
              </p>
            </div>
            <Badge tone={active.is_active ? "green" : "neutral"} dot>{active.is_active ? "Active" : "Paused"}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Scheduled", String(active.scheduled)],
              ["Delivered", String(active.delivered)],
              ["Failed", String(active.failed)],
              ["Pending", String(active.pending)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-navy-100 bg-soft-slate px-3 py-2.5">
                <p className="text-[8px] font-extrabold uppercase tracking-wider text-navy-400">{label}</p>
                <p className="mt-0.5 text-sm font-extrabold text-navy-900">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-navy-400">Next run: {analytics.next_run}</p>
        </Card>
      )}
    </>
  );
}

function CampaignsTab({ campaigns, templates, token, isLive, initialDistrict, onChanged, onNotice }: {
  campaigns: Campaign[];
  templates: MessageTemplate[];
  token: string | null;
  isLive: boolean;
  initialDistrict: string;
  onChanged: () => Promise<void>;
  onNotice: (text: string) => void;
}) {
  const [name, setName] = useState(initialDistrict ? `Follow-up — ${initialDistrict}` : "");
  const [templateKey, setTemplateKey] = useState("EMPLOYMENT_30_DAY");
  const [district, setDistrict] = useState(initialDistrict);
  const [employment, setEmployment] = useState("");
  const [consentOnly, setConsentOnly] = useState(true);
  const [followupDue, setFollowupDue] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<{ eligible: number; consent_available: number; excluded: number; total: number; sample: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-xs font-bold text-navy-800 outline-none focus:border-primary-500";

  const audience: AudienceFilter = useMemo(() => ({
    ...(district.trim() ? { district: district.trim() } : {}),
    ...(employment ? { employment_status: employment } : {}),
    ...(followupDue ? { followup_due: true } : {}),
    ...(consentOnly ? { consent_given: true } : {}),
  }), [district, employment, followupDue, consentOnly]);

  const doPreview = async () => {
    setBusy(true);
    try {
      setPreview(await api.previewAudience(audience, token));
    } catch {
      onNotice("Audience preview failed. Please retry.");
    } finally {
      setBusy(false);
    }
  };

  const create = async (andSchedule: boolean) => {
    if (!name.trim()) {
      onNotice("Give the campaign a name first.");
      return;
    }
    setBusy(true);
    try {
      const campaign = await api.createCampaign(
        { name: name.trim(), template_key: templateKey, audience, scheduled_at: scheduledAt || undefined },
        token,
      );
      if (andSchedule) {
        const result = await api.scheduleCampaign(campaign.id, token);
        onNotice(`Campaign scheduled: ${result.jobs} messages queued (consent-enforced). Run a demo to process them now.`);
        await api.runCampaignDemo(campaign.id, token);
        onNotice(`Demo run finished — statuses are SIMULATED, persisted per message. Refresh to see counts.`);
      } else {
        onNotice(`Campaign "${campaign.name}" created as draft.`);
      }
      await onChanged();
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "Campaign action failed.");
    } finally {
      setBusy(false);
    }
  };

  const runDemo = async (id: string) => {
    setBusy(true);
    try {
      const result = await api.runCampaignDemo(id, token);
      onNotice(`Demo run: ${result.sent} sent (SIMULATED), ${result.failed} failed, ${result.cancelled} cancelled. Honest per-message statuses stored.`);
      await onChanged();
    } catch {
      onNotice("Demo run failed.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    setBusy(true);
    try {
      await api.cancelCampaign(id, token);
      onNotice("Campaign cancelled; open jobs were cancelled too.");
      await onChanged();
    } catch {
      onNotice("Cancel failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
      <Card className="overflow-hidden">
        <div className="border-b border-navy-100 p-5">
          <h2 className="text-base font-extrabold text-navy-900">Recent campaigns</h2>
          <p className="mt-0.5 text-[10px] text-navy-400">Audience, schedule, delivery honesty per message.</p>
        </div>
        {campaigns.length === 0 ? (
          <p className="p-6 text-center text-xs font-bold text-navy-500" role="status">No campaigns yet — create the first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="bg-soft-slate text-[8px] font-extrabold uppercase tracking-[0.1em] text-navy-400">
                  <th scope="col" className="px-4 py-3">Campaign</th>
                  <th scope="col" className="px-3 py-3 text-right">Sent</th>
                  <th scope="col" className="px-3 py-3 text-right">Delivered</th>
                  <th scope="col" className="px-3 py-3 text-right">Failed</th>
                  <th scope="col" className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-extrabold text-navy-900">{campaign.name}</p>
                      <p className="mt-0.5 text-[9px] text-navy-400">{audienceSummary(campaign.audience_filter)} · {campaign.status}</p>
                    </td>
                    <td className="px-3 py-3 text-right text-[11px] font-bold">{campaign.sent}</td>
                    <td className="px-3 py-3 text-right text-[11px] font-bold">{campaign.delivered}</td>
                    <td className="px-3 py-3 text-right text-[11px] font-bold">{campaign.failed}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        {(campaign.status === "DRAFT" || campaign.status === "SCHEDULED") && (
                          <Button size="sm" variant="outline" disabled={busy || !isLive} onClick={() => void (async () => { setBusy(true); try { await api.scheduleCampaign(campaign.id, token); onNotice("Campaign scheduled."); await onChanged(); } catch { onNotice("Schedule failed."); } finally { setBusy(false); } })()}>Schedule</Button>
                        )}
                        <Button size="sm" variant="outline" disabled={busy || !isLive} onClick={() => void runDemo(campaign.id)}>Run demo</Button>
                        {(campaign.status === "RUNNING" || campaign.status === "SCHEDULED") && (
                          <Button size="sm" variant="ghost" disabled={busy || !isLive} onClick={() => void cancel(campaign.id)}>Cancel</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="h-fit p-5">
        <h2 className="text-base font-extrabold text-navy-900">Create campaign</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Campaign name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Follow-up — Pune" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Message template</span>
            <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} className={inputClass}>
              {templates.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.template_key}>{t.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-navy-700">District</span>
              <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass} placeholder="Pune" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-navy-700">Employment</span>
              <select value={employment} onChange={(e) => setEmployment(e.target.value)} className={inputClass}>
                <option value="">Any status</option>
                <option value="employed">Employed</option>
                <option value="unemployed">Unemployed</option>
                <option value="self_employed">Self-employed</option>
                <option value="apprenticeship">Apprenticeship</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-bold text-navy-700">
            <input type="checkbox" checked={consentOnly} onChange={(e) => setConsentOnly(e.target.checked)} className="size-4 accent-emerald-600" />
            WhatsApp opted-in only (required for sending)
          </label>
          <label className="flex items-center gap-2 text-[11px] font-bold text-navy-700">
            <input type="checkbox" checked={followupDue} onChange={(e) => setFollowupDue(e.target.checked)} className="size-4 accent-emerald-600" />
            Follow-up due within 30 days
          </label>
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Schedule for later (optional)</span>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputClass} />
          </label>
          <Button variant="outline" size="sm" disabled={busy || !isLive} onClick={() => void doPreview()}>Preview audience</Button>
          {preview && (
            <div className="rounded-xl border border-navy-100 bg-soft-slate p-3 text-[11px]" role="status">
              <p className="font-extrabold text-navy-900">Eligible trainees: {preview.eligible}</p>
              <p className="mt-0.5 text-navy-600">Consent available: {preview.consent_available} · Excluded: {preview.excluded}</p>
              {preview.sample.map((s) => <p key={s} className="mt-0.5 font-mono text-[9px] text-navy-400">{s}</p>)}
              {!consentOnly && <p className="mt-1 font-bold text-amber-700">Sending is still consent-enforced at schedule time.</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || !isLive} onClick={() => void create(false)}><Plus className="size-3.5" /> Create draft</Button>
            <Button size="sm" variant="outline" disabled={busy || !isLive} onClick={() => void create(true)}>
              <Send className="size-3.5" /> Create, schedule & demo-run
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AutomationsTab({ automations, templates, token, isLive, onChanged }: {
  automations: Automation[];
  templates: MessageTemplate[];
  token: string | null;
  isLive: boolean;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("30/60/90 Day Employment Follow-up");
  const [delays, setDelays] = useState("30, 60, 90");
  const [templateKey, setTemplateKey] = useState("EMPLOYMENT_30_DAY");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-xs font-bold text-navy-800 outline-none focus:border-primary-500";

  const toggle = async (rule: Automation) => {
    setBusy(true);
    try {
      await api.updateAutomation(rule.id, { is_active: !rule.is_active }, token);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    const delayList = delays.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0 && n <= 365);
    if (!name.trim() || delayList.length === 0) {
      setNotice("Name and at least one delay (0–365 days) are required.");
      return;
    }
    setBusy(true);
    try {
      await api.createAutomation({ name: name.trim(), delay_days: delayList, template_key: templateKey || undefined }, token);
      setNotice("Automation created. Outcome submissions now enroll trainees per this rule (consent-enforced).");
      await onChanged();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  };

  const previewDelays = delays.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
      <Card className="h-fit p-5">
        <h2 className="text-base font-extrabold text-navy-900">Active automations</h2>
        <div className="mt-4 space-y-3">
          {automations.map((rule) => (
            <div key={rule.id} className="rounded-2xl border border-navy-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-navy-900">{rule.name}</p>
                  <p className="mt-0.5 text-[10px] text-navy-400">
                    {rule.delay_days.map((d) => `${d}-day`).join(" / ")} check-ins · {rule.enrolled} trainees · next run: scheduler tick
                  </p>
                </div>
                <Badge tone={rule.is_active ? "green" : "neutral"} dot>{rule.is_active ? "Active" : "Paused"}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[[rule.scheduled, "Scheduled"], [rule.delivered, "Delivered"], [rule.failed, "Failed"], [rule.pending, "Pending"]].map(([v, l]) => (
                  <div key={l as string} className="rounded-lg bg-soft-slate px-2 py-1.5">
                    <p className="text-sm font-extrabold text-navy-900">{v}</p>
                    <p className="text-[8px] font-bold uppercase tracking-wider text-navy-400">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button size="sm" variant="outline" disabled={busy || !isLive} onClick={() => void toggle(rule)}>
                  {rule.is_active ? <><Pause className="size-3.5" /> Pause</> : <><Play className="size-3.5" /> Activate</>}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="h-fit p-5">
        <h2 className="text-base font-extrabold text-navy-900">+ Create automation</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Trigger</span>
            <input value="Employment outcome submitted" disabled className={cn(inputClass, "opacity-60")} />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Delays (days, comma-separated)</span>
            <input value={delays} onChange={(e) => setDelays(e.target.value)} className={inputClass} placeholder="30, 60, 90" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Message template</span>
            <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} className={inputClass}>
              {templates.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.template_key}>{t.name}</option>)}
            </select>
          </label>
          <div className="rounded-xl border border-navy-100 bg-soft-slate p-3" aria-label="Automation preview">
            {["Employment Started", ...previewDelays.flatMap((d) => [`Wait ${d} days`, "Check Consent", "Send WhatsApp"])].map((step, i) => (
              <div key={`${step}-${i}`} className="flex items-start gap-2">
                <div className="flex flex-col items-center">
                  <span className="grid size-5 place-items-center rounded-full bg-primary-600 text-[8px] font-extrabold text-white">{i + 1}</span>
                  {i < previewDelays.length * 3 && <span className="h-3 w-px bg-navy-200" />}
                </div>
                <p className="pb-2 text-[10px] font-bold text-navy-700">{step}</p>
              </div>
            ))}
            <p className="mt-1 text-[9px] text-navy-400">Stops when consent is revoked or the number is removed.</p>
          </div>
          <Button size="sm" disabled={busy || !isLive} onClick={() => void create()}><Plus className="size-3.5" /> Create automation</Button>
          {notice && <p className="text-[11px] font-bold text-navy-600" role="status">{notice}</p>}
        </div>
      </Card>
    </div>
  );
}

function TemplatesTab({ templates, token, isLive, onChanged }: {
  templates: MessageTemplate[];
  token: string | null;
  isLive: boolean;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [body, setBody] = useState("Hi {{first_name}}, ");
  const [variables, setVariables] = useState("first_name");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-navy-200 bg-white px-3 text-xs font-bold text-navy-800 outline-none focus:border-primary-500";

  const create = async () => {
    if (!name.trim() || !key.trim() || body.trim().length < 10) {
      setNotice("Name, KEY and a body of at least 10 characters are required.");
      return;
    }
    setBusy(true);
    try {
      await api.createMessageTemplate(
        { name: name.trim(), template_key: key.trim().toUpperCase(), body, variables: variables.split(",").map((s) => s.trim()).filter(Boolean) },
        token,
      );
      setNotice("Template created.");
      setName("");
      setKey("");
      setBody("Hi {{first_name}}, ");
      await onChanged();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
      <Card className="h-fit p-5">
        <h2 className="text-base font-extrabold text-navy-900">Message templates</h2>
        <div className="mt-4 space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-2xl border border-navy-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-navy-900">{t.name}</p>
                <Badge tone={t.is_active ? "green" : "neutral"}>{t.template_key}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-line rounded-lg bg-soft-slate p-3 font-mono text-[10px] leading-5 text-navy-600">{t.body}</p>
              <p className="mt-1.5 text-[9px] text-navy-400">Variables: {t.variables.join(", ") || "—"}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="h-fit p-5">
        <h2 className="text-base font-extrabold text-navy-900">Create template</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Employment Check-in" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Key (A-Z, 0-9, _)</span>
            <input value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} className={inputClass} placeholder="EMPLOYMENT_CHECKIN" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Body (use {"{{variable}}"} placeholders)</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="mt-1.5 w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 font-mono text-[11px] text-navy-800 outline-none focus:border-primary-500" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-navy-700">Variables (comma-separated)</span>
            <input value={variables} onChange={(e) => setVariables(e.target.value)} className={inputClass} placeholder="first_name, company_name" />
          </label>
          <Button size="sm" disabled={busy || !isLive} onClick={() => void create()}><Plus className="size-3.5" /> Create template</Button>
          {notice && <p className="text-[11px] font-bold text-navy-600" role="status">{notice}</p>}
        </div>
      </Card>
    </div>
  );
}

function TraineesTab({ token, isLive, templates, initialDistrict, onNotice, onChanged }: {
  token: string | null;
  isLive: boolean;
  templates: MessageTemplate[];
  initialDistrict: string;
  onNotice: (text: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [district, setDistrict] = useState(initialDistrict);
  const [course, setCourse] = useState("");
  const [employment, setEmployment] = useState("");
  const [consent, setConsent] = useState("");
  const [followupDue, setFollowupDue] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<TraineeOutreachRow[]>([]);
  const [counts, setCounts] = useState({ eligible: 0, excluded: 0, total: 0 });
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ profile: TraineeOutreachRow; outcomes: Array<Record<string, unknown>>; followups: Array<Record<string, unknown>> } | null>(null);
  const [sendTemplate, setSendTemplate] = useState("EMPLOYMENT_UPDATE_REMINDER");
  const [busy, setBusy] = useState(false);
  const inputClass = "mt-1 h-10 w-full rounded-xl border border-navy-200 bg-white px-2.5 text-[11px] font-bold text-navy-800 outline-none focus:border-primary-500";

  const load = useCallback(async () => {
    if (!isLive) return;
    setBusy(true);
    try {
      const result = await api.getOutreachTrainees({
        district: district.trim() || undefined,
        course: course.trim() || undefined,
        employment_status: employment || undefined,
        consent: consent || undefined,
        followup_due: followupDue ? "true" : undefined,
        search: search.trim() || undefined,
      }, token);
      setRows(result.rows);
      setCounts(result.counts);
      setSelected([]);
    } catch {
      onNotice("Trainee list failed to load.");
    } finally {
      setBusy(false);
    }
  }, [token, isLive, district, course, employment, consent, followupDue, search, onNotice]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isLive]);

  const toggleSelect = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  const expand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    try {
      setDetail(await api.getOutreachTrainee(id, token));
    } catch {
      onNotice("Profile detail failed to load.");
    }
  };

  const sendOne = async (id: string) => {
    setBusy(true);
    try {
      const result = await api.sendOneMessage(id, sendTemplate, token);
      onNotice(`Message ${result.status} (${result.simulated ? "SIMULATED — nothing left the server" : "handed to provider"}).`);
      await load();
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "Send failed (consent enforced).");
    } finally {
      setBusy(false);
    }
  };

  const bulkCampaign = async () => {
    if (selected.length === 0) {
      onNotice("Select at least one trainee first.");
      return;
    }
    setBusy(true);
    try {
      const campaign = await api.createCampaign(
        { name: `Bulk follow-up — ${selected.length} trainees`, template_key: sendTemplate, audience: { trainee_ids: selected } },
        token,
      );
      const result = await api.scheduleCampaign(campaign.id, token);
      onNotice(`Bulk campaign queued ${result.jobs} messages (consent-enforced). Use Run demo on the Campaigns tab to process.`);
      await onChanged();
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "Bulk campaign failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-2 border-b border-navy-100 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="block"><span className="text-[9px] font-extrabold uppercase tracking-wider text-navy-400">District</span>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass} placeholder="Pune" /></label>
        <label className="block"><span className="text-[9px] font-extrabold uppercase tracking-wider text-navy-400">Course</span>
          <input value={course} onChange={(e) => setCourse(e.target.value)} className={inputClass} placeholder="CNC" /></label>
        <label className="block"><span className="text-[9px] font-extrabold uppercase tracking-wider text-navy-400">Employment</span>
          <select value={employment} onChange={(e) => setEmployment(e.target.value)} className={inputClass}>
            <option value="">Any</option><option value="employed">Employed</option><option value="unemployed">Unemployed</option>
            <option value="self_employed">Self-employed</option><option value="apprenticeship">Apprenticeship</option>
          </select></label>
        <label className="block"><span className="text-[9px] font-extrabold uppercase tracking-wider text-navy-400">Consent</span>
          <select value={consent} onChange={(e) => setConsent(e.target.value)} className={inputClass}>
            <option value="">All</option><option value="opted-in">Opted-in</option><option value="not-given">Not given</option>
          </select></label>
        <label className="flex items-end gap-2 pb-2 text-[11px] font-bold text-navy-700">
          <input type="checkbox" checked={followupDue} onChange={(e) => setFollowupDue(e.target.checked)} className="size-4 accent-emerald-600" /> Follow-up due</label>
        <div className="flex items-end gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass} placeholder="Search name" aria-label="Search trainees" />
          <Button size="sm" disabled={busy} onClick={() => void load()}>Apply</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-navy-100 bg-soft-slate px-4 py-3">
        <p className="text-[11px] font-bold text-navy-600">{counts.eligible} eligible · {counts.excluded} excluded · {counts.total} in scope</p>
        <div className="ml-auto flex items-center gap-2">
          <select value={sendTemplate} onChange={(e) => setSendTemplate(e.target.value)} className="h-9 rounded-xl border border-navy-200 bg-white px-2 text-[11px] font-bold" aria-label="Message template">
            {templates.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.template_key}>{t.name}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={busy || selected.length === 0} onClick={() => void bulkCampaign()}>
            <UsersRound className="size-3.5" /> Campaign ({selected.length})
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs font-bold text-navy-500" role="status">No trainees match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="bg-soft-slate text-[8px] font-extrabold uppercase tracking-[0.1em] text-navy-400">
                <th scope="col" className="px-3 py-3"><span className="sr-only">Select</span></th>
                <th scope="col" className="px-3 py-3">Name</th>
                <th scope="col" className="px-3 py-3">District</th>
                <th scope="col" className="px-3 py-3">Training</th>
                <th scope="col" className="px-3 py-3">Employment</th>
                <th scope="col" className="px-3 py-3">Follow-up</th>
                <th scope="col" className="px-3 py-3">WhatsApp</th>
                <th scope="col" className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {rows.map((row) => (
                <Fragment key={row.trainee_id}>
                  <tr>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.includes(row.trainee_id)} onChange={() => toggleSelect(row.trainee_id)} className="size-4 accent-emerald-600" aria-label={`Select ${row.name}`} />
                    </td>
                    <td className="px-3 py-3 text-[11px] font-extrabold text-navy-900">{row.name}</td>
                    <td className="px-3 py-3 text-[11px] text-navy-600">{row.district}</td>
                    <td className="px-3 py-3 text-[11px] text-navy-600">{row.training ?? "—"}</td>
                    <td className="px-3 py-3 text-[11px] text-navy-600">{row.employment ?? "—"}{row.company ? ` · ${row.company}` : ""}</td>
                    <td className="px-3 py-3 text-[11px] text-navy-600">{row.next_followup ?? "—"}</td>
                    <td className="px-3 py-3">
                      <Badge tone={row.whatsapp_consent ? "green" : "neutral"}>{row.whatsapp_consent ? "Opted-in" : "No"}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => void expand(row.trainee_id)}>View</Button>
                        <Button size="sm" variant="outline" disabled={busy || !row.whatsapp_consent} onClick={() => void sendOne(row.trainee_id)} title={row.whatsapp_consent ? "Send message" : "No consent — excluded"}>
                          <Send className="size-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expanded === row.trainee_id && (
                    <tr>
                      <td colSpan={8} className="bg-soft-slate px-4 py-3">
                        {!detail ? (
                          <p className="text-[11px] text-navy-400">Loading…</p>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-wider text-navy-400">Outcome history</p>
                              <ul className="mt-1.5 space-y-1.5">
                                {detail.outcomes.length === 0 && <li className="text-[11px] text-navy-500">No outcomes recorded.</li>}
                                {detail.outcomes.map((o) => (
                                  <li key={String(o.id)} className="text-[11px] text-navy-700">
                                    {String(o.outcome_type)} · {String(o.status)} · {String(o.role ?? "—")} · {String(o.submitted_at).slice(0, 10)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-wider text-navy-400">Follow-ups</p>
                              <ul className="mt-1.5 space-y-1.5">
                                {detail.followups.length === 0 && <li className="text-[11px] text-navy-500">No follow-ups scheduled.</li>}
                                {detail.followups.map((f) => (
                                  <li key={String(f.id)} className="text-[11px] text-navy-700">
                                    {String(f.scheduled_for)} · {String(f.channel ?? "—")} · {String(f.status)}{String(f.response ?? "") && ` · replied ${String(f.response)}`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-navy-100 px-4 py-3 text-[10px] text-navy-400">
        <Sparkles className="size-3.5" /> Only opted-in trainees receive messages — others are excluded automatically.
      </div>
    </Card>
  );
}
