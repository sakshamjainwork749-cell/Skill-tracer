"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageCircle, Pause, Play, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { WhatsAppHistoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const SCHEDULE_DAYS = [30, 60, 90];

export function WhatsAppFollowup() {
  const { token, isDemoSession } = useAuth();
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [history, setHistory] = useState<WhatsAppHistoryItem[]>([]);
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [provider, setProvider] = useState("demo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ status: string; simulated: boolean; notice: string } | null>(null);
  const [error, setError] = useState("");
  const isLive = Boolean(token && !isDemoSession && !token.startsWith("demo-"));

  const refresh = async () => {
    if (!isLive) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [status, rows] = await Promise.all([
        api.getWhatsAppStatus(token),
        api.getWhatsAppHistory(token),
      ]);
      setPhoneMasked(status.phone_masked);
      setConsent(status.consent);
      setProvider(status.provider);
      setNextDate(status.next_followup);
      setHistory(rows);
    } catch {
      setError("Could not load WhatsApp follow-up status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isDemoSession]);

  const toggleConsent = async (next: boolean) => {
    setSaving(true);
    setError("");
    try {
      const result = await api.setWhatsAppConsent(next, token);
      setConsent(result.whatsapp_followup_consent);
      if (!next && result.cancelled_future > 0) {
        setSendResult({
          status: "PAUSED",
          simulated: false,
          notice: `${result.cancelled_future} future message(s) cancelled. Nothing will be sent while paused.`,
        });
      }
      await refresh();
    } catch {
      setError("Could not update WhatsApp consent. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  const demoSend = async () => {
    setSending(true);
    setError("");
    setSendResult(null);
    try {
      const result = await api.demoSendWhatsApp(token);
      setSendResult({ status: result.status, simulated: result.simulated, notice: result.notice });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Automated send failed.");
    } finally {
      setSending(false);
    }
  };

  const last = history.length > 0 ? history[history.length - 1] : null;

  return (
    <Card className="p-5" aria-label="WhatsApp follow-up">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-emerald-700">WhatsApp follow-up</p>
          <h3 className="mt-0.5 text-sm font-extrabold text-navy-900">
            Status: {consent ? "Enabled" : "Paused"}
          </h3>
        </div>
        <Badge tone={consent ? "green" : "neutral"} dot>{consent ? "Enabled" : "Paused"}</Badge>
      </div>

      {loading ? (
        <p className="mt-4 text-[11px] text-navy-400" role="status">Loading follow-up status…</p>
      ) : !isLive ? (
        <p className="mt-4 rounded-xl bg-soft-slate p-3 text-[11px] leading-5 text-navy-500">
          Sign in with your trainee account to manage live WhatsApp follow-ups.
        </p>
      ) : (
        <dl className="mt-4 space-y-2 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="font-bold text-navy-400">WhatsApp number</dt>
            <dd className="font-extrabold text-navy-900">{phoneMasked ?? "Not on file"}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="font-bold text-navy-400">Follow-up schedule</dt>
            <dd className="font-extrabold text-navy-900">{SCHEDULE_DAYS.map((d) => `${d} days`).join(" · ")}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="font-bold text-navy-400">Next follow-up</dt>
            <dd className="font-extrabold text-navy-900">{nextDate ?? "None scheduled"}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="font-bold text-navy-400">Last message</dt>
            <dd className="font-extrabold text-navy-900">
              {last ? `${(last.template ?? "check-in").replaceAll("_", " ")} — ${last.display_status}` : "No messages yet"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="font-bold text-navy-400">Provider</dt>
            <dd className="font-extrabold text-navy-900">{provider === "demo" ? "Demo mode" : provider}</dd>
          </div>
        </dl>
      )}

      {isLive && !loading && (
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-2 text-[11px] font-bold text-navy-700">
            <input
              type="checkbox"
              checked={consent}
              disabled={saving}
              onChange={(event) => void toggleConsent(event.target.checked)}
              className="mt-0.5 size-4 accent-emerald-600"
            />
            I agree to receive SkillTrace employment follow-up messages on WhatsApp.
          </label>
          <div className="flex flex-wrap gap-2">
            {consent ? (
              <Button size="sm" variant="outline" onClick={() => void toggleConsent(false)} disabled={saving}>
                <Pause className="size-3.5" /> Pause Follow-up
              </Button>
            ) : (
              <Button size="sm" onClick={() => void toggleConsent(true)} disabled={saving}>
                <Play className="size-3.5" /> Enable Follow-up
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void demoSend()} disabled={sending || !consent}>
              <Send className="size-3.5" /> {sending ? "Sending…" : "Run Automated Send"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/trainee/profile"
              className="inline-flex h-9 items-center rounded-xl border border-navy-200 bg-white/70 px-3.5 text-xs font-semibold text-navy transition hover:border-teal/40"
            >
              Update WhatsApp Number
            </Link>
            <a
              href="#followup-history"
              className="inline-flex h-9 items-center rounded-xl border border-navy-200 bg-white/70 px-3.5 text-xs font-semibold text-navy transition hover:border-teal/40"
            >
              View Follow-up History
            </a>
          </div>
        </div>
      )}

      {sendResult && (
        <div
          className={cn(
            "mt-4 rounded-xl border p-4",
            sendResult.simulated
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50",
          )}
          role="status"
        >
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-navy-900">
            <CheckCircle2 className="size-3.5" />
            {sendResult.simulated ? "Demo Mode — Message queued, SIMULATED" : `Automated send: ${sendResult.status}`}
          </p>
          <p className="mt-1 text-[10px] leading-4 text-navy-600">{sendResult.notice}</p>
          {sendResult.simulated && (
            <p className="mt-1 text-[10px] font-bold text-navy-600">
              Provider: Mock WhatsApp · Status: SIMULATED (nothing left this server).
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700" role="alert">{error}</p>
      )}
    </Card>
  );
}
