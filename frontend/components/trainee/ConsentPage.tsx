"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ConsentPreferences } from "@/lib/types";

const consentFields = [
  ["data_processing_allowed", "Allow data processing", "Let SkillTrace process my training and outcome data."],
  ["consent_given", "Overall consent", "I consent to participate in outcome tracking."],
  ["employer_verification_consent", "Allow employer verification", "Employers may confirm the outcomes I report. Without this, my updates stay out of employer queues."],
  ["followup_consent", "Allow employment status follow-ups", "SkillTrace may check in on my work status."],
  ["email_followup_consent", "Contact me by email", "Receive follow-ups at my registered email address."],
  ["whatsapp_followup_consent", "Contact me by WhatsApp", "Receive follow-ups on WhatsApp."],
] as const;

export function ConsentPage() {
  const { token, isDemoSession } = useAuth();
  const [consent, setConsent] = useState<ConsentPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isLive = Boolean(token && !isDemoSession && !token.startsWith("demo-"));

  useEffect(() => {
    if (!isLive) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .getTraineePassport(token)
      .then((passport) => {
        if (!active) return;
        setConsent({
          data_processing_allowed: passport.trainee.data_processing_allowed,
          consent_given: passport.trainee.consent_given,
          employer_verification_consent: passport.trainee.employer_verification_consent ?? false,
          followup_consent: passport.trainee.followup_consent ?? false,
          email_followup_consent: passport.trainee.email_followup_consent ?? false,
          whatsapp_followup_consent: passport.trainee.whatsapp_followup_consent ?? false,
        });
      })
      .catch(() => {
        if (active) setError("Could not load your current preferences. Please retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, isDemoSession, isLive]);

  const save = async () => {
    if (!consent || !isLive) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.updateConsent(consent, token);
      setMessage("Preferences saved. They apply immediately and persist after refresh.");
    } catch {
      setError("Could not save preferences. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      role="trainee"
      title="Privacy & consent"
      subtitle="Control how your outcome data is used"
    >
      <Card className="max-w-3xl p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-success-600">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-navy-900">Your consent preferences</h2>
            <p className="mt-1 text-xs leading-5 text-navy-500">
              Saved to your SkillTrace account. Turning off employer verification keeps
              your updates out of employer verification queues.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-xs text-navy-400" role="status">Loading current preferences…</p>
        ) : !isLive ? (
          <p className="mt-6 rounded-xl bg-soft-slate p-4 text-xs leading-5 text-navy-500">
            Sign in with your trainee account to manage live consent. Demo mode shows illustrative settings only.
          </p>
        ) : consent ? (
          <div className="mt-6 space-y-3">
            {consentFields.map(([key, label, body]) => (
              <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 p-4 transition hover:border-primary-200">
                <input
                  type="checkbox"
                  checked={consent[key]}
                  disabled={saving}
                  onChange={(event) => {
                    setConsent({ ...consent, [key]: event.target.checked });
                    setMessage("");
                  }}
                  className="mt-0.5 size-4 accent-emerald-600"
                />
                <span>
                  <span className="block text-xs font-extrabold text-navy-900">{label}</span>
                  <span className="mt-0.5 block text-[11px] leading-5 text-navy-500">{body}</span>
                </span>
              </label>
            ))}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save preferences"}
              </Button>
              {message && (
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700" role="status">
                  <CheckCircle2 className="size-3.5" /> {message}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700" role="alert">{error}</p>
        )}
      </Card>
    </AppShell>
  );
}
