"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { api, isOfflineError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type {
  VerificationQueueRow,
  VerificationStatus,
  VerificationUpdate,
} from "@/lib/types";
import { cn, getInitials } from "@/lib/utils";

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-navy/12 bg-white px-3 text-sm text-navy outline-none transition placeholder:text-navy/30 focus:border-teal focus:ring-4 focus:ring-teal/10";

type Decision = "verify" | "correct";

export function VerificationDrawer({
  row,
  open,
  onClose,
  onOptimistic,
  onRevert,
}: {
  row: VerificationQueueRow | null;
  open: boolean;
  onClose: () => void;
  onOptimistic: (id: string, status: VerificationStatus) => void;
  onRevert: (id: string, previous: VerificationStatus) => void;
}) {
  const { token, isDemoSession } = useAuth();
  const [form, setForm] = useState<VerificationUpdate>({
    employment_status: "employed",
    joining_date: "",
    wage_band: "",
    role: "",
    location: "",
    skill_relevance: 0,
    feedback: "",
    correction_reason: "",
  });
  const [strength, setStrength] = useState("");
  const [support, setSupport] = useState("");
  const [decision, setDecision] = useState<Decision>("verify");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!row || !open) return;
    setForm({
      employment_status: "employed",
      joining_date: row.reported.start_date,
      wage_band: row.reported.wage_band,
      role: row.reported.role,
      location: row.reported.location,
      skill_relevance: row.confidence >= 85 ? 4 : 3,
      feedback: "",
      correction_reason: row.status === "needs_correction" ? "Please review the joining date and current role details." : "",
    });
    setStrength("Applies learned skills");
    setSupport("");
    setDecision(row.status === "needs_correction" ? "correct" : "verify");
    setErrors({});
    setSubmitError(null);
    setComplete(false);
  }, [row, open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 50);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, submitting]);

  if (!open || !row) return null;

  const update = <K extends keyof VerificationUpdate>(key: K, value: VerificationUpdate[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.role.trim()) nextErrors.role = "Role is required.";
    if (!form.joining_date) nextErrors.joining_date = "Joining date is required.";
    if (!form.wage_band.trim()) nextErrors.wage_band = "Wage band is required.";
    if (!form.location.trim()) nextErrors.location = "Location is required.";
    if (form.skill_relevance < 1) nextErrors.skill_relevance = "Choose a skill relevance rating.";
    if (decision === "correct" && !form.correction_reason?.trim()) {
      nextErrors.correction_reason = "Tell the trainee what needs correction.";
    }
    if (decision === "verify" && !form.feedback.trim()) {
      nextErrors.feedback = "A short verification note is required.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    const previous = row.status;
    const nextStatus: VerificationStatus = decision === "verify" ? "verified" : "needs_correction";
    const structuredFeedback = `Strength: ${strength || "Not specified"}. Support: ${support || "None noted"}. ${form.feedback}`.trim();
    const payload: VerificationUpdate = {
      ...form,
      feedback: structuredFeedback,
    };
    onOptimistic(row.employment_id, nextStatus);

    try {
      const useDemo = isDemoSession || !token || token.startsWith("demo-");
      if (useDemo) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      } else {
        try {
          await api.updateVerification(row.employment_id, payload, token);
        } catch (error) {
          if (!isOfflineError(error)) {
            onRevert(row.employment_id, previous);
            throw error;
          }
        }
      }
      setComplete(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save this verification.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-navy/50 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[640px] flex-col bg-paper shadow-lift"
      >
        <div className="flex items-center justify-between gap-4 border-b border-navy/8 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-teal">Outcome verification</p>
            <h2 id="verification-drawer-title" className="mt-1 text-lg font-extrabold tracking-tight text-navy">
              {complete ? "Verification recorded" : "Review trainee outcome"}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="grid size-10 place-items-center rounded-xl border border-navy/10 text-navy/50 transition hover:bg-navy/5 hover:text-navy"
            aria-label="Close verification drawer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {complete ? (
            <div className="grid min-h-[620px] place-items-center p-7 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid size-20 place-items-center rounded-[1.75rem] bg-emerald-100 text-emerald-700"><BadgeCheck className="size-9" /></div>
                <Badge tone={decision === "verify" ? "green" : "amber"} dot className="mx-auto mt-6">
                  {decision === "verify" ? "Outcome verified" : "Correction requested"}
                </Badge>
                <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight text-navy">
                  {decision === "verify" ? "Thank you for closing the evidence loop." : "The trainee has a clear next step."}
                </h3>
                <p className="mt-3 text-sm leading-6 text-navy/55">
                  {decision === "verify"
                    ? `${row.trainee.name}’s employment and skill feedback are now reflected in the Outcome Passport.`
                    : `A correction request for ${row.trainee.name} is ready with your structured note.`}
                </p>
                <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-xl bg-teal-soft text-teal"><CheckCircle2 className="size-4" /></div>
                    <div>
                      <p className="text-xs font-bold text-navy">Demo update completed</p>
                      <p className="mt-0.5 text-[10px] text-navy/40">The queue changed optimistically and is saved locally.</p>
                    </div>
                  </div>
                </div>
                <Button className="mt-7 min-w-40" onClick={onClose}>Back to queue <ArrowRight className="size-4" /></Button>
              </div>
            </div>
          ) : (
            <form id="verification-form" onSubmit={submit} noValidate>
              <div className="border-b border-navy/8 bg-navy px-5 py-6 text-white sm:px-7">
                <div className="flex items-start gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-soft font-display text-lg font-semibold text-teal">{getInitials(row.trainee.name)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold">{row.trainee.name}</h3>
                      <Badge tone={row.confidence >= 85 ? "green" : "amber"}>{row.confidence}% match</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-white/35">{row.trainee.internal_identifier}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-white/50">
                      <span className="inline-flex items-center gap-1.5"><GraduationCap className="size-3.5 text-saffron" /> {row.course.name}</span>
                      <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-saffron" /> {row.trainee.district}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-7 px-5 py-6 sm:px-7">
                <section aria-labelledby="confirm-details-title">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-teal-soft text-teal"><Building2 className="size-4" /></span>
                    <div>
                      <h4 id="confirm-details-title" className="text-sm font-bold text-navy">1. Confirm employment details</h4>
                      <p className="mt-0.5 text-[10px] text-navy/40">Correct anything that does not match your records.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-bold text-navy/70">Employment status</span>
                      <select className={inputClass} value={form.employment_status} onChange={(event) => update("employment_status", event.target.value as VerificationUpdate["employment_status"])}>
                        <option value="employed">Currently employed</option>
                        <option value="apprenticeship">Currently apprenticing</option>
                        <option value="left">No longer working here</option>
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-bold text-navy/70">Role / apprenticeship title *</span>
                      <input className={inputClass} value={form.role} onChange={(event) => update("role", event.target.value)} />
                      {errors.role && <span className="mt-1 block text-[10px] font-semibold text-red-600">{errors.role}</span>}
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-navy/70">Joining date *</span>
                      <input type="date" className={inputClass} value={form.joining_date} onChange={(event) => update("joining_date", event.target.value)} />
                      {errors.joining_date && <span className="mt-1 block text-[10px] font-semibold text-red-600">{errors.joining_date}</span>}
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-navy/70">Monthly wage band *</span>
                      <select className={inputClass} value={form.wage_band} onChange={(event) => update("wage_band", event.target.value)}>
                        <option value="">Choose a band</option>
                        <option>₹10K–₹15K</option>
                        <option>₹15K–₹20K</option>
                        <option>₹15k–₹25k</option>
                        <option>₹20K–₹25K</option>
                        <option>₹25K–₹30K</option>
                        <option>₹25k–₹40k</option>
                        <option>₹30K–₹40K</option>
                        <option>₹40K+</option>
                      </select>
                      {errors.wage_band && <span className="mt-1 block text-[10px] font-semibold text-red-600">{errors.wage_band}</span>}
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs font-bold text-navy/70">Work location *</span>
                      <input className={inputClass} value={form.location} onChange={(event) => update("location", event.target.value)} />
                      {errors.location && <span className="mt-1 block text-[10px] font-semibold text-red-600">{errors.location}</span>}
                    </label>
                  </div>
                </section>

                <section className="border-t border-navy/8 pt-6" aria-labelledby="skill-feedback-title">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-saffron-soft text-[#92540B]"><Sparkles className="size-4" /></span>
                    <div>
                      <h4 id="skill-feedback-title" className="text-sm font-bold text-navy">2. Rate skill relevance</h4>
                      <p className="mt-0.5 text-[10px] text-navy/40">How closely does the trainee’s training match this role?</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-navy/10 bg-white p-4" role="radiogroup" aria-label="Skill relevance from one to five stars" aria-describedby={errors.skill_relevance ? "skill-rating-error" : undefined}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex gap-1" role="presentation">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            role="radio"
                            aria-checked={form.skill_relevance === rating}
                            aria-label={`${rating} star${rating > 1 ? "s" : ""}`}
                            onClick={() => update("skill_relevance", rating)}
                            className="grid size-9 place-items-center rounded-lg transition hover:bg-saffron-soft focus-visible:ring-4 focus-visible:ring-saffron/20"
                          >
                            <Star className={cn("size-6 transition", form.skill_relevance >= rating ? "fill-saffron text-saffron" : "text-navy/15")} />
                          </button>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-navy">{form.skill_relevance ? `${form.skill_relevance} / 5` : "Not rated"}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-[9px] font-bold uppercase tracking-wider text-navy/30"><span>Low match</span><span>Exact match</span></div>
                    {errors.skill_relevance && <p id="skill-rating-error" className="mt-2 text-[10px] font-semibold text-red-600">{errors.skill_relevance}</p>}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold text-navy/70">Observed strength</span>
                      <select className={inputClass} value={strength} onChange={(event) => setStrength(event.target.value)}>
                        <option value="">Choose one</option>
                        <option>Applies learned skills</option>
                        <option>Strong technical foundation</option>
                        <option>Fast learning ability</option>
                        <option>Reliable attendance</option>
                        <option>Good customer communication</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-navy/70">Support recommended</span>
                      <select className={inputClass} value={support} onChange={(event) => setSupport(event.target.value)}>
                        <option value="">None</option>
                        <option>Advanced role skills</option>
                        <option>Digital tools</option>
                        <option>Communication</option>
                        <option>Workplace readiness</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="border-t border-navy/8 pt-6" aria-labelledby="verification-note-title">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-xl bg-navy text-saffron"><UserRoundCheck className="size-4" /></span>
                    <div>
                      <h4 id="verification-note-title" className="text-sm font-bold text-navy">3. Add a clear note</h4>
                      <p className="mt-0.5 text-[10px] text-navy/40">Structured feedback becomes part of the consented evidence trail.</p>
                    </div>
                  </div>
                  <label className="mt-5 block">
                    <span className="text-xs font-bold text-navy/70">{decision === "correct" ? "What needs correction? *" : "Verification note *"}</span>
                    <textarea
                      rows={4}
                      className="mt-2 w-full resize-none rounded-xl border border-navy/12 bg-white p-3 text-sm text-navy outline-none transition placeholder:text-navy/30 focus:border-teal focus:ring-4 focus:ring-teal/10"
                      value={decision === "correct" ? form.correction_reason : form.feedback}
                      onChange={(event) => update(decision === "correct" ? "correction_reason" : "feedback", event.target.value)}
                      placeholder={decision === "correct" ? "Describe the field and accurate value for the trainee…" : "Share concise, job-related feedback…"}
                    />
                    {errors.correction_reason && <span className="mt-1 block text-[10px] font-semibold text-red-600">{errors.correction_reason}</span>}
                    {errors.feedback && <span className="mt-1 block text-[10px] font-semibold text-red-600">{errors.feedback}</span>}
                  </label>
                </section>

                {submitError && (
                  <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" />{submitError}</p>
                )}
              </div>
            </form>
          )}
        </div>

        {!complete && (
          <div className="border-t border-navy/8 bg-white px-5 py-4 sm:px-7">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={decision === "correct" ? "primary" : "outline"}
                onClick={() => { setDecision("correct"); setErrors({}); }}
                className={cn(decision === "correct" && "ring-4 ring-saffron/10")}
              >
                Request correction
              </Button>
              <Button
                type="button"
                variant={decision === "verify" ? "primary" : "outline"}
                onClick={() => { setDecision("verify"); setErrors({}); }}
                className={cn(decision === "verify" && "ring-4 ring-teal/10")}
              >
                <ShieldCheck className="size-4" /> Confirm
              </Button>
            </div>
            <Button type="submit" form="verification-form" loading={submitting} className="mt-3 w-full">
              {decision === "verify" ? "Verify & update passport" : "Send correction request"} <ArrowRight className="size-4" />
            </Button>
            <p className="mt-2 text-center text-[9px] text-navy/30">Submitted under your employer verification authority</p>
          </div>
        )}
      </div>
    </div>
  );
}
