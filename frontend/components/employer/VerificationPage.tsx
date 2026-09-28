"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Send,
  ShieldCheck,
  Star,
  UserRoundCheck,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api, isOfflineError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { demoVerificationQueue } from "@/lib/demo-data";
import { formatDate, getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Decision = "confirm" | "correction" | "reject";
type Relevance = "yes" | "partially" | "no";

export function VerificationPage({ id }: { id: string }) {
  const [liveRequest, setLiveRequest] = useState<(typeof demoVerificationQueue)[number] | null>(null);
  const [loadError, setLoadError] = useState("");
  const request = useMemo(() => liveRequest ?? demoVerificationQueue.find((item) => item.employment_id === id) ?? demoVerificationQueue[0], [id, liveRequest]);
  const [decision, setDecision] = useState<Decision>("confirm");
  const [rating, setRating] = useState(0);
  const [relevance, setRelevance] = useState<Relevance>("yes");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { token, isDemoSession } = useAuth();

  useEffect(() => {
    if (!token || isDemoSession || token.startsWith("demo-")) return;
    let active = true;
    api
      .getVerificationQueue(token)
      .then((rows) => {
        if (!active) return;
        const found = rows.find((row) => row.employment_id === id);
        if (found) {
          setLiveRequest({
            ...found,
            trainee: { ...found.trainee },
            course: { ...found.course, pass_year: found.course.pass_year },
            reported: { ...found.reported },
          } as (typeof demoVerificationQueue)[number]);
        } else {
          setLoadError("This request is not in your live verification queue. Showing demo data.");
        }
      })
      .catch(() => {
        if (active) setLoadError("Live queue unavailable — showing demo data.");
      });
    return () => {
      active = false;
    };
  }, [id, token, isDemoSession]);

  const submit = async () => {
    if (!rating) {
      setError("Add an overall performance rating before submitting.");
      return;
    }
    if (decision !== "confirm" && !feedback.trim()) {
      setError(
        decision === "reject"
          ? "Add a short note explaining why the claim is rejected."
          : "Add a short note explaining what needs correction.",
      );
      return;
    }
    setError("");
    setSubmitting(true);
    const useDemo = isDemoSession || !token || token.startsWith("demo-");
    try {
      if (!useDemo) {
        await api.updateVerification(
          request.employment_id,
          {
            employment_status: "employed",
            joining_date: request.reported.start_date,
            wage_band: request.reported.wage_band,
            role: request.reported.role,
            location: request.reported.location,
            skill_relevance: rating,
            feedback,
            decision,
            ...(decision !== "confirm" ? { correction_reason: feedback } : {}),
          },
          token,
        );
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      if (!isOfflineError(caught)) {
        setError(caught instanceof Error ? caught.message : "Could not submit verification feedback.");
      } else {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AppShell role="employer" title="Verification complete" subtitle="Outcome feedback submitted">
        <Card className="mx-auto max-w-2xl p-7 text-center sm:p-10">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-50 text-success-600">
            <CheckCircle2 className="size-10 animate-scale-in" />
          </div>
          <Badge tone={decision === "confirm" ? "green" : decision === "reject" ? "red" : "amber"} className="mx-auto mt-6" dot>
            {decision === "confirm" ? "Employment verified" : decision === "reject" ? "Claim rejected" : "Correction requested"}
          </Badge>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-navy-900">
            {decision === "confirm" ? "Thank you for closing the loop." : decision === "reject" ? "The claim has been rejected." : "The trainee has a clear next step."}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-navy-500">
            {decision === "confirm"
              ? `${request.trainee.name}’s employment and skill feedback are now reflected in the Outcome Passport.`
              : decision === "reject"
                ? `${request.trainee.name}’s claim was rejected with your note and removed from the verification queue.`
                : `A correction request for ${request.trainee.name} is ready with your structured note.`}
          </p>
          <div className="mx-auto mt-6 flex max-w-sm items-center gap-3 rounded-xl border border-navy-100 bg-soft-slate p-4 text-left">
            <div className="grid size-9 place-items-center rounded-lg bg-primary-50 text-primary-700"><ShieldCheck className="size-4" /></div>
            <div>
              <p className="text-xs font-extrabold text-navy-900">Request {request.employment_id}</p>
              <p className="mt-0.5 text-[10px] text-navy-400">
                {isDemoSession || !token || token.startsWith("demo-")
                  ? "Submitted just now · Demo response saved locally"
                  : "Submitted just now · Saved to the SkillTrace backend"}
              </p>
            </div>
          </div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/employer/dashboard" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-xs font-extrabold text-white transition hover:bg-primary-700">Back to queue <ArrowLeft className="size-4" /></Link>
            <Link href="/employer/dashboard" className="inline-flex h-11 items-center justify-center rounded-xl border border-navy-200 px-5 text-xs font-extrabold text-navy-700">Review another</Link>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell role="employer" title="Review verification request" subtitle={`Request ${request.employment_id}`}>
      <div className="mx-auto max-w-5xl">
        <Link href="/employer/dashboard" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-navy-500 transition hover:text-primary-600">
          <ArrowLeft className="size-4" /> Back to verification queue
        </Link>
        {loadError && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] font-bold text-amber-800" role="status">{loadError}</p>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-[.82fr_1.18fr]">
          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="bg-navy-900 p-5 text-white sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-600 text-sm font-extrabold">{getInitials(request.trainee.name)}</div>
                  <div>
                    <Badge className="bg-white/10 text-white ring-white/15">{request.employment_id}</Badge>
                    <h1 className="mt-2 text-lg font-extrabold tracking-tight">{request.trainee.name}</h1>
                    <p className="mt-1 font-mono text-[10px] text-white/40">{request.trainee.internal_identifier}</p>
                  </div>
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Reported details</p>
                <dl className="mt-4 divide-y divide-navy-100">
                  {[
                    [GraduationCap, "Course", request.course.name],
                    [BriefcaseBusiness, "Reported role", request.reported.role],
                    [Building2, "Joining date", formatDate(request.reported.start_date)],
                    [MapPin, "Work location", request.reported.location],
                  ].map(([Icon, label, value]) => {
                    const RowIcon = Icon as typeof GraduationCap;
                    return (
                      <div key={label as string} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-navy-100 text-navy-600"><RowIcon className="size-3.5" /></div>
                        <div>
                          <dt className="text-[9px] font-extrabold uppercase tracking-wider text-navy-400">{label as string}</dt>
                          <dd className="mt-1 text-xs font-extrabold text-navy-800">{value as string}</dd>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-start gap-3 py-3 last:pb-0">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-success-600"><BadgeCheck className="size-3.5" /></div>
                    <div>
                      <dt className="text-[9px] font-extrabold uppercase tracking-wider text-navy-400">Reported monthly salary</dt>
                      <dd className="mt-1 text-sm font-extrabold text-navy-900">{request.reported.wage_band}</dd>
                    </div>
                  </div>
                </dl>
              </div>
            </Card>

            <Card className="border-primary-100 bg-primary-50 p-5">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary-700" />
                <div>
                  <h2 className="text-xs font-extrabold text-navy-900">Consent confirmed</h2>
                  <p className="mt-1.5 text-[10px] leading-5 text-navy-500">This trainee has authorised the employer to verify the reported employment outcome. Private documents and contact details are not shown.</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-navy-100 px-5 py-5 sm:px-6">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600">Decision & feedback</p>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy-900">Complete the verification</h2>
              <p className="mt-1 text-xs leading-5 text-navy-500">Confirm the outcome or flag a correction, then share structured job-related feedback.</p>
            </div>

            <div className="space-y-7 p-5 sm:p-6">
              <fieldset>
                <legend className="text-sm font-extrabold text-navy-900">1. Employment decision</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => { setDecision("confirm"); setError(""); }}
                    className={cn("flex items-start gap-3 rounded-xl border p-4 text-left transition", decision === "confirm" ? "border-success-500 bg-emerald-50 ring-4 ring-emerald-500/10" : "border-navy-200 hover:border-emerald-300")}
                    aria-pressed={decision === "confirm"}
                  >
                    <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", decision === "confirm" ? "bg-success-600 text-white" : "bg-emerald-50 text-success-600")}><Check className="size-4" /></div>
                    <div>
                      <p className="text-xs font-extrabold text-navy-900">Confirm Employment</p>
                      <p className="mt-1 text-[10px] leading-4 text-navy-500">The reported role and joining details are correct.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDecision("correction"); setError(""); }}
                    className={cn("flex items-start gap-3 rounded-xl border p-4 text-left transition", decision === "correction" ? "border-warning-500 bg-warning-50 ring-4 ring-warning-500/10" : "border-navy-200 hover:border-warning-300")}
                    aria-pressed={decision === "correction"}
                  >
                    <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", decision === "correction" ? "bg-warning-500 text-navy-900" : "bg-red-50 text-red-600")}><X className="size-4" /></div>
                    <div>
                      <p className="text-xs font-extrabold text-navy-900">Needs Correction / Not Employed</p>
                      <p className="mt-1 text-[10px] leading-4 text-navy-500">The record is inaccurate or employment has ended.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDecision("reject"); setError(""); }}
                    className={cn("flex items-start gap-3 rounded-xl border p-4 text-left transition", decision === "reject" ? "border-red-500 bg-red-50 ring-4 ring-red-500/10" : "border-navy-200 hover:border-red-300")}
                    aria-pressed={decision === "reject"}
                  >
                    <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg", decision === "reject" ? "bg-red-600 text-white" : "bg-red-50 text-red-600")}><X className="size-4" /></div>
                    <div>
                      <p className="text-xs font-extrabold text-navy-900">Reject claim</p>
                      <p className="mt-1 text-[10px] leading-4 text-navy-500">The employment claim is invalid or fraudulent.</p>
                    </div>
                  </button>
                </div>
              </fieldset>

              <fieldset className="border-t border-navy-100 pt-6">
                <legend className="text-sm font-extrabold text-navy-900">2. Overall employee performance</legend>
                <p className="mt-1 text-[10px] text-navy-400">Rate performance in the current role from 1 to 5.</p>
                <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Overall performance rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={`${value} star${value > 1 ? "s" : ""}`}
                      onClick={() => { setRating(value); setError(""); }}
                      className="grid size-10 place-items-center rounded-lg transition hover:bg-warning-50 focus-visible:ring-4 focus-visible:ring-warning-500/15"
                    >
                      <Star className={cn("size-6 transition", rating >= value ? "fill-warning-500 text-warning-500" : "text-navy-200")} />
                    </button>
                  ))}
                  <span className="ml-2 text-[10px] font-extrabold text-navy-500">{rating ? `${rating} / 5` : "Not rated"}</span>
                </div>
              </fieldset>

              <fieldset className="border-t border-navy-100 pt-6">
                <legend className="text-sm font-extrabold text-navy-900">3. Is the training relevant to the job role?</legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    ["yes", "Yes"],
                    ["partially", "Partially"],
                    ["no", "No"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRelevance(value as Relevance)}
                      className={cn("h-11 rounded-xl border text-xs font-extrabold transition", relevance === value ? "border-primary-500 bg-primary-600 text-white" : "border-navy-200 bg-white text-navy-600 hover:border-primary-300")}
                      aria-pressed={relevance === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block border-t border-navy-100 pt-6">
                <span className="text-sm font-extrabold text-navy-900">4. Additional feedback</span>
                <span className="mt-1 block text-[10px] text-navy-400">Optional feedback on skill gaps or performance.</span>
                <textarea
                  rows={5}
                  value={feedback}
                  onChange={(event) => { setFeedback(event.target.value); setError(""); }}
                  className="mt-3 w-full resize-none rounded-xl border border-navy-200 bg-white p-3.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
                  placeholder="e.g. Strong technical foundation. Additional practice with preventive maintenance would help."
                />
              </label>

              {decision !== "confirm" && (
                <div className="flex gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-700" />
                  <p className="text-[10px] leading-5 text-navy-600">
                    {decision === "reject"
                      ? "A rejection note is required so the decision is recorded with a reason."
                      : "A correction note is required so the trainee knows exactly what to update."}
                  </p>
                </div>
              )}
              {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold text-red-700" role="alert">{error}</div>}
            </div>

            <div className="border-t border-navy-100 bg-soft-slate p-5 sm:p-6">
              <Button className="w-full" size="lg" onClick={submit} loading={submitting} disabled={submitting}>
                <UserRoundCheck className="size-4" /> Submit Feedback & Verification <Send className="size-4" />
              </Button>
              <p className="mt-2 text-center text-[9px] text-navy-400">Submitted under your employer verification authority</p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
