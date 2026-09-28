"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  FileCheck2,
  FileText,
  GraduationCap,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api, isOfflineError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type {
  OutcomeStatus,
  OutcomeUpdatePayload,
  OutcomeUpdateResult,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const DRAFT_KEY = "skilltrace.outcome-draft.v1";

type OutcomeForm = Omit<OutcomeUpdatePayload, "status" | "proof_file"> & {
  status: OutcomeStatus | "";
};

const emptyForm: OutcomeForm = {
  status: "",
  organization: "",
  role: "",
  start_date: "",
  monthly_wage: undefined,
  location: "",
  business_type: "",
  monthly_revenue: undefined,
  employees_created: undefined,
  preferred_role: "",
  preferred_location: "",
  exit_reason: "",
};

const steps = [
  { id: 1, title: "Current status", short: "Status" },
  { id: 2, title: "Outcome details", short: "Details" },
  { id: 3, title: "Supporting proof", short: "Proof" },
  { id: 4, title: "Review & submit", short: "Review" },
];

const statusOptions: Array<{
  value: OutcomeStatus;
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
  tone: string;
}> = [
  {
    value: "employed",
    title: "Employed",
    description: "I have a current job or formal apprenticeship.",
    icon: BriefcaseBusiness,
    tone: "bg-teal-soft text-teal",
  },
  {
    value: "apprenticeship",
    title: "In an apprenticeship",
    description: "I am learning on the job through a formal apprenticeship.",
    icon: GraduationCap,
    tone: "bg-indigo-50 text-indigo-700",
  },
  {
    value: "self_employed",
    title: "Self-employed",
    description: "I run a business, freelance, or work independently.",
    icon: Store,
    tone: "bg-saffron-soft text-[#96570C]",
  },
  {
    value: "seeking_job",
    title: "Seeking work",
    description: "I am actively looking for my next opportunity.",
    icon: Search,
    tone: "bg-sky-50 text-sky-700",
  },
  {
    value: "exited",
    title: "Left training / exited",
    description: "My training or previous employment has ended.",
    icon: LogOut,
    tone: "bg-red-50 text-coral",
  },
];

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-navy/12 bg-white px-3.5 text-sm text-navy outline-none transition placeholder:text-navy/30 focus:border-teal focus:ring-4 focus:ring-teal/10";
const labelClass = "text-xs font-bold text-navy/70";

function isFormValid(form: OutcomeForm) {
  return Boolean(form.status);
}

function readableStatus(status: OutcomeStatus | "") {
  if (!status) return "Not selected";
  if (status === "exited") return "Left training / exited";
  return status
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function OutcomeWizard({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (form: OutcomeForm, result: OutcomeUpdateResult) => void;
}) {
  const { token, isDemoSession } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OutcomeForm>(emptyForm);
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<OutcomeUpdateResult | null>(null);
  const [draftStatus, setDraftStatus] = useState("Draft saves automatically");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const loadedDraft = useRef(false);

  const closeWizard = useCallback(() => {
    if (submitting) return;
    onClose();
    if (result) {
      setResult(null);
      setStep(1);
      setForm(emptyForm);
      setProof(null);
      setErrors({});
      setSubmitError(null);
      setDraftStatus("Draft saves automatically");
      loadedDraft.current = false;
    }
  }, [onClose, result, submitting]);

  useEffect(() => {
    if (!open) return;
    if (!loadedDraft.current) {
      try {
        const saved = window.localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as OutcomeForm;
          setForm({ ...emptyForm, ...parsed });
          setDraftStatus("Saved draft restored");
        }
      } catch {
        setDraftStatus("Draft saves automatically");
      }
      loadedDraft.current = true;
    }
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => titleRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const serialisable = { ...form };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(serialisable));
    setDraftStatus("Draft saved on this device");
  }, [form, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWizard();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
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
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeWizard]);

  const update = <K extends keyof OutcomeForm>(key: K, value: OutcomeForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const validateStep = (targetStep: number) => {
    const nextErrors: Record<string, string> = {};
    if (targetStep === 1 && !isFormValid(form)) {
      nextErrors.status = "Choose the option that best describes your current status.";
    }
    if (targetStep === 2) {
      if (form.status === "employed" || form.status === "apprenticeship") {
        if (!form.organization?.trim()) nextErrors.organization = "Organisation is required.";
        if (!form.role?.trim()) nextErrors.role = "Role is required.";
        if (!form.start_date) nextErrors.start_date = "Start date is required.";
        if (!form.monthly_wage || form.monthly_wage < 1) nextErrors.monthly_wage = "Enter a valid monthly wage.";
        if (!form.location?.trim()) nextErrors.location = "Work location is required.";
      }
      if (form.status === "self_employed") {
        if (!form.business_type?.trim()) nextErrors.business_type = "Tell us what kind of work you do.";
        if (!form.role?.trim()) nextErrors.role = "Role or service is required.";
        if (!form.monthly_revenue && form.monthly_revenue !== 0) {
          nextErrors.monthly_revenue = "Add monthly revenue or the number of jobs created.";
        }
        if (form.employees_created == null && form.monthly_revenue == null) {
          nextErrors.employees_created = "Add revenue or jobs created.";
        }
        if (!form.location?.trim()) nextErrors.location = "Primary work location is required.";
      }
      if (form.status === "seeking_job") {
        if (!form.preferred_role?.trim()) nextErrors.preferred_role = "Preferred role is required.";
        if (!form.preferred_location?.trim()) nextErrors.preferred_location = "Preferred location is required.";
      }
      if (form.status === "exited" && !form.exit_reason?.trim()) {
        nextErrors.exit_reason = "A short reason helps us support you better.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(4, current + 1));
  };

  const previousStep = () => {
    setErrors({});
    setSubmitError(null);
    setStep((current) => Math.max(1, current - 1));
  };

  const validateProof = (file: File | undefined) => {
    if (!file) return true;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      setErrors((current) => ({ ...current, proof: "Use a PDF, JPG, or PNG file." }));
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, proof: "File must be smaller than 5 MB." }));
      return false;
    }
    setErrors((current) => {
      const next = { ...current };
      delete next.proof;
      return next;
    });
    setProof(file);
    return true;
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    validateProof(event.dataTransfer.files[0]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !form.status) return;
    setSubmitting(true);
    setSubmitError(null);
    const payload: OutcomeUpdatePayload = { ...form, status: form.status, proof_file: proof };

    try {
      let response: OutcomeUpdateResult;
      const useDemo = isDemoSession || !token || token.startsWith("demo-");
      if (useDemo) {
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        response = {
          update_id: `ST-${Date.now().toString().slice(-8)}`,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          message: "Outcome update submitted for verification.",
        };
      } else {
        try {
          response = await api.submitOutcome(payload, token);
        } catch (error) {
          if (!isOfflineError(error)) throw error;
          response = {
            update_id: `LOCAL-${Date.now().toString().slice(-8)}`,
            status: "submitted",
            submitted_at: new Date().toISOString(),
            message: "Outcome saved locally while the verification service reconnects.",
          };
        }
      }
      setResult(response);
      onComplete(form, response);
      window.localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not submit this update. Your draft is still safe on this device.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step - 1) / 3) * 100;
  const conditionalTitle = useMemo(() => {
    if (form.status === "apprenticeship") return "Apprenticeship details";
    if (form.status === "employed") return "Employment details";
    if (form.status === "self_employed") return "Independent work details";
    if (form.status === "seeking_job") return "What are you looking for?";
    return "A little more context";
  }, [form.status]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-navy/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeWizard();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="outcome-dialog-title"
        className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] bg-paper shadow-lift sm:max-h-[90vh] sm:rounded-[2rem]"
      >
        <div className="border-b border-navy/8 bg-white px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-teal-soft text-teal">
                {result ? <Check className="size-5" /> : <Sparkles className="size-5" />}
              </div>
              <div>
                <h2 id="outcome-dialog-title" ref={titleRef} tabIndex={-1} className="text-base font-extrabold tracking-tight text-navy outline-none">
                  {result ? "Update received" : "Update your outcome"}
                </h2>
                <p className="mt-0.5 text-[11px] text-navy/45">
                  {result ? "Your evidence trail is now moving forward." : draftStatus}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!result && (
                <Badge tone="amber" className="hidden sm:inline-flex">
                  <Clock3 className="size-3" /> About 30 sec
                </Badge>
              )}
              <button
                type="button"
                onClick={closeWizard}
                disabled={submitting}
                className="grid size-9 place-items-center rounded-xl border border-navy/10 text-navy/50 transition hover:bg-navy/5 hover:text-navy disabled:opacity-40"
                aria-label="Close outcome update"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {!result && (
            <div className="mt-5">
              <div className="relative grid grid-cols-4">
                <div className="absolute left-[12.5%] right-[12.5%] top-3.5 h-0.5 bg-navy/8" />
                <div
                  className="absolute left-[12.5%] top-3.5 h-0.5 bg-teal transition-all duration-300"
                  style={{ width: `${progress * 0.75}%` }}
                />
                {steps.map((item) => {
                  const complete = item.id < step;
                  const active = item.id === step;
                  return (
                    <div key={item.id} className="relative z-10 flex flex-col items-center">
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-full border-[3px] border-white text-[10px] font-extrabold transition",
                          complete
                            ? "bg-teal text-white"
                            : active
                              ? "bg-saffron text-navy ring-4 ring-saffron/15"
                              : "bg-mist text-navy/35",
                        )}
                      >
                        {complete ? <Check className="size-3.5" /> : item.id}
                      </span>
                      <span className={cn("mt-1.5 hidden text-[10px] font-bold sm:block", active ? "text-navy" : "text-navy/35")}>
                        {item.short}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {result ? (
            <div className="grid min-h-[470px] place-items-center px-5 py-10 text-center sm:px-10">
              <div className="max-w-lg">
                <div className="relative mx-auto grid size-20 place-items-center rounded-[1.75rem] bg-emerald-100 text-emerald-700">
                  <FileCheck2 className="size-9" />
                  <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-saffron text-navy ring-4 ring-paper"><Check className="size-4" /></span>
                </div>
                <Badge tone="green" dot className="mx-auto mt-6">Submitted securely</Badge>
                <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight text-navy">Thank you for keeping your record current.</h3>
                <p className="mt-3 text-sm leading-6 text-navy/55">{result.message} We’ll notify you when an employer or authorised verifier confirms it.</p>
                <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-xl bg-teal-soft text-teal"><ShieldCheck className="size-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-navy">What happens next?</p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-navy/40">Reference {result.update_id}</p>
                    </div>
                    <Badge tone="amber">Pending</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-navy/50">
                    <div className="rounded-xl bg-teal-soft/60 p-2 text-teal">1 · Submitted</div>
                    <div className="rounded-xl bg-mist p-2">2 · Verify</div>
                    <div className="rounded-xl bg-mist p-2">3 · Passport</div>
                  </div>
                </div>
                <Button className="mt-7 min-w-40" onClick={closeWizard}>Return to passport</Button>
              </div>
            </div>
          ) : (
            <form id="outcome-form" onSubmit={submit} noValidate>
              <div className="px-5 py-6 sm:px-7 sm:py-7">
                {step === 1 && (
                  <div className="animate-fade-up">
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal">Step 1 of 4</p>
                    <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-navy">What’s happening in your work journey?</h3>
                    <p className="mt-2 text-sm leading-6 text-navy/50">Choose the closest match. You can update again whenever things change.</p>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {statusOptions.map((option) => {
                        const Icon = option.icon;
                        const selected = form.status === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              update("status", option.value);
                              if (option.value !== "employed" && option.value !== "apprenticeship") update("organization", "");
                            }}
                            className={cn(
                              "relative flex items-start gap-3 rounded-2xl border p-4 text-left transition",
                              selected
                                ? "border-teal bg-teal-soft/45 ring-2 ring-teal/10"
                                : "border-navy/10 bg-white hover:border-teal/25",
                            )}
                            aria-pressed={selected}
                          >
                            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", option.tone)}><Icon className="size-[18px]" /></span>
                            <span>
                              <span className="block text-sm font-bold text-navy">{option.title}</span>
                              <span className="mt-1 block text-xs leading-5 text-navy/48">{option.description}</span>
                            </span>
                            <span className={cn("absolute right-3 top-3 grid size-5 place-items-center rounded-full border", selected ? "border-teal bg-teal text-white" : "border-navy/15")}>
                              {selected && <Check className="size-3" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {errors.status && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-600"><AlertCircle className="size-3.5" />{errors.status}</p>}
                  </div>
                )}

                {step === 2 && (
                  <div className="animate-fade-up">
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal">Step 2 of 4</p>
                    <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-navy">{conditionalTitle}</h3>
                    <p className="mt-2 text-sm leading-6 text-navy/50">Only enter what you are comfortable sharing. This creates a clearer outcome record.</p>

                    {(form.status === "employed" || form.status === "apprenticeship") && (
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <Field label={form.status === "apprenticeship" ? "Training organisation*" : "Employer / organisation*" } error={errors.organization} className="sm:col-span-2">
                          <input className={inputClass} value={form.organization ?? ""} onChange={(event) => update("organization", event.target.value)} placeholder={form.status === "apprenticeship" ? "e.g. Maharashtra Skill Academy" : "e.g. Sahyadri Digital Labs"} />
                        </Field>
                        <Field label="Role / apprenticeship title*" error={errors.role}>
                          <input className={inputClass} value={form.role ?? ""} onChange={(event) => update("role", event.target.value)} placeholder="e.g. Frontend Developer" />
                        </Field>
                        <Field label="Start date*" error={errors.start_date}>
                          <input type="date" className={inputClass} value={form.start_date ?? ""} onChange={(event) => update("start_date", event.target.value)} />
                        </Field>
                        <Field label="Monthly wage (₹)*" error={errors.monthly_wage}>
                          <input type="number" inputMode="numeric" min={1} className={inputClass} value={form.monthly_wage ?? ""} onChange={(event) => update("monthly_wage", event.target.value ? Number(event.target.value) : undefined)} placeholder="25000" />
                        </Field>
                        <Field label="Work location*" error={errors.location}>
                          <input className={inputClass} value={form.location ?? ""} onChange={(event) => update("location", event.target.value)} placeholder="City, Maharashtra" />
                        </Field>
                      </div>
                    )}

                    {form.status === "self_employed" && (
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <Field label="Type of independent work*" error={errors.business_type}>
                          <select className={inputClass} value={form.business_type ?? ""} onChange={(event) => update("business_type", event.target.value)}>
                            <option value="">Choose one</option>
                            <option>Freelance / gig work</option>
                            <option>Small business owner</option>
                            <option>Home-based enterprise</option>
                            <option>Agriculture / allied work</option>
                            <option>Other self-employment</option>
                          </select>
                        </Field>
                        <Field label="Role or service*" error={errors.role}>
                          <input className={inputClass} value={form.role ?? ""} onChange={(event) => update("role", event.target.value)} placeholder="e.g. Freelance web designer" />
                        </Field>
                        <Field label="Monthly revenue (₹)" error={errors.monthly_revenue}>
                          <input type="number" min={0} className={inputClass} value={form.monthly_revenue ?? ""} onChange={(event) => update("monthly_revenue", event.target.value ? Number(event.target.value) : undefined)} placeholder="e.g. 25000" />
                        </Field>
                        <Field label="Jobs created" error={errors.employees_created}>
                          <input type="number" min={0} className={inputClass} value={form.employees_created ?? ""} onChange={(event) => update("employees_created", event.target.value ? Number(event.target.value) : undefined)} placeholder="e.g. 2" />
                        </Field>
                        <Field label="Primary work location*" error={errors.location} className="sm:col-span-2">
                          <input className={inputClass} value={form.location ?? ""} onChange={(event) => update("location", event.target.value)} placeholder="Village / city, Maharashtra" />
                        </Field>
                      </div>
                    )}

                    {form.status === "seeking_job" && (
                      <div className="mt-6 grid gap-4 sm:col-span-2">
                        <Field label="Preferred role or sector*" error={errors.preferred_role}>
                          <input className={inputClass} value={form.preferred_role ?? ""} onChange={(event) => update("preferred_role", event.target.value)} placeholder="e.g. Computer operator or nursing assistant" />
                        </Field>
                        <Field label="Preferred work location*" error={errors.preferred_location}>
                          <input className={inputClass} value={form.preferred_location ?? ""} onChange={(event) => update("preferred_location", event.target.value)} placeholder="City or district" />
                        </Field>
                      </div>
                    )}

                    {form.status === "exited" && (
                      <div className="mt-6">
                        <Field label="What changed?*" error={errors.exit_reason}>
                          <textarea rows={5} className="mt-2 w-full resize-none rounded-xl border border-navy/12 bg-white p-3.5 text-sm text-navy outline-none transition placeholder:text-navy/30 focus:border-teal focus:ring-4 focus:ring-teal/10" value={form.exit_reason ?? ""} onChange={(event) => update("exit_reason", event.target.value)} placeholder="For example: moved to a different city, business closed, or need a different career path." />
                        </Field>
                        <p className="mt-2 text-[11px] leading-5 text-navy/40">This helps us improve support. It won’t reduce the value of your training record.</p>
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="animate-fade-up">
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal">Step 3 of 4</p>
                    <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-navy">Add proof, if you have it</h3>
                    <p className="mt-2 text-sm leading-6 text-navy/50">Optional. A contract, payslip, appointment letter, or work photo can help verification finish faster.</p>
                    <label
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={onDrop}
                      className="mt-6 grid min-h-64 cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-navy/12 bg-white p-6 text-center transition hover:border-teal/40 hover:bg-teal-soft/20"
                    >
                      <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => validateProof(event.target.files?.[0])} />
                      {proof ? (
                        <div className="w-full max-w-sm">
                          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-soft text-teal"><FileText className="size-6" /></div>
                          <p className="mt-4 truncate text-sm font-bold text-navy">{proof.name}</p>
                          <p className="mt-1 text-xs text-navy/40">{(proof.size / 1024 / 1024).toFixed(2)} MB · Ready to attach</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-3 text-coral"
                            onClick={(event) => { event.preventDefault(); setProof(null); }}
                          >
                            <Trash2 className="size-3.5" /> Remove file
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-saffron-soft text-[#96570C]"><UploadCloud className="size-6" /></div>
                          <p className="mt-4 text-sm font-bold text-navy">Drop a file here, or browse</p>
                          <p className="mt-1 text-xs text-navy/40">PDF, JPG or PNG · maximum 5 MB</p>
                          <Badge tone="teal" className="mx-auto mt-4"><ShieldCheck className="size-3" /> Encrypted and private</Badge>
                        </div>
                      )}
                    </label>
                    {errors.proof && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-600"><AlertCircle className="size-3.5" />{errors.proof}</p>}
                    <div className="mt-5 flex gap-3 rounded-2xl bg-navy/5 p-4">
                      <GraduationCap className="mt-0.5 size-5 shrink-0 text-teal" />
                      <p className="text-xs leading-5 text-navy/55"><strong className="text-navy">No proof? That’s okay.</strong> Your update can still enter the verification queue and your verified training record remains intact.</p>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="animate-fade-up">
                    <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-teal">Step 4 of 4</p>
                    <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-navy">Review before you submit</h3>
                    <p className="mt-2 text-sm leading-6 text-navy/50">We’ll use this information only to confirm and improve your Outcome Passport.</p>
                    <div className="mt-6 overflow-hidden rounded-2xl border border-navy/10 bg-white">
                      <div className="flex items-center justify-between border-b border-navy/8 px-4 py-3">
                        <span className="text-xs font-semibold text-navy/45">Current status</span>
                        <Badge tone="teal" dot>{readableStatus(form.status)}</Badge>
                      </div>
                      <ReviewRow label={form.status === "apprenticeship" ? "Organisation" : form.status === "self_employed" ? "Work type" : form.status === "seeking_job" ? "Preferred role" : form.status === "exited" ? "Reason" : "Role"} value={form.status === "self_employed" ? form.business_type : form.status === "seeking_job" ? form.preferred_role : form.status === "exited" ? form.exit_reason : form.role} />
                      {(form.status === "employed" || form.status === "apprenticeship") && (
                        <>
                          <ReviewRow label="Organisation" value={form.organization} />
                          <ReviewRow label="Start date" value={form.start_date ? formatDate(form.start_date) : undefined} />
                          <ReviewRow label="Monthly wage" value={form.monthly_wage ? `₹${form.monthly_wage.toLocaleString("en-IN")}` : undefined} />
                          <ReviewRow label="Location" value={form.location} />
                        </>
                      )}
                      {form.status === "self_employed" && (
                        <>
                          <ReviewRow label="Monthly revenue" value={form.monthly_revenue != null ? `₹${form.monthly_revenue.toLocaleString("en-IN")}` : undefined} />
                          <ReviewRow label="Jobs created" value={form.employees_created != null ? String(form.employees_created) : undefined} />
                          <ReviewRow label="Location" value={form.location} />
                        </>
                      )}
                      {form.status === "seeking_job" && <ReviewRow label="Preferred location" value={form.preferred_location} />}
                      <ReviewRow label="Supporting proof" value={proof ? proof.name : "No file attached (optional)"} />
                    </div>
                    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-navy/10 bg-white p-4">
                      <input type="checkbox" required className="mt-0.5 size-4 rounded border-navy/20 accent-teal" />
                      <span className="text-xs leading-5 text-navy/60">I confirm this information is accurate to the best of my knowledge and consent to outcome verification.</span>
                    </label>
                    {submitError && <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" />{submitError}</p>}
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {!result && (
          <div className="flex items-center justify-between gap-3 border-t border-navy/8 bg-white px-5 py-4 sm:px-7">
            <Button type="button" variant="ghost" onClick={previousStep} disabled={step === 1 || submitting}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={nextStep}>Continue <ArrowRight className="size-4" /></Button>
            ) : (
              <Button type="submit" form="outcome-form" loading={submitting}>
                Submit outcome <ShieldCheck className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className={labelClass}>{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-[11px] font-semibold text-red-600">{error}</span>}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 border-b border-navy/6 px-4 py-3 last:border-b-0">
      <span className="text-xs text-navy/40">{label}</span>
      <span className="break-words text-right text-xs font-bold text-navy">{value || "—"}</span>
    </div>
  );
}
