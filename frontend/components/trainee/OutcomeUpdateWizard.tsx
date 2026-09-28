"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { api, ApiError, isOfflineError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type WorkStatus = "working" | "self_employed" | "apprenticeship" | "not_working";
type SalaryRange = "<15k" | "15k-25k" | "25k-40k" | "40k+" | "";

const statusOptions: Array<{
  value: WorkStatus;
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}> = [
  { value: "working", title: "Yes, I’m working", description: "I have a current job or paid role.", icon: BriefcaseBusiness },
  { value: "self_employed", title: "I’m self-employed", description: "I run a business, freelance or gig work.", icon: Store },
  { value: "apprenticeship", title: "I’m doing an apprenticeship", description: "I am learning on the job.", icon: GraduationCap },
  { value: "not_working", title: "I’m not working / seeking job", description: "I am looking for my next opportunity.", icon: Search },
];

const salaryOptions: Array<{ value: Exclude<SalaryRange, "">; label: string }> = [
  { value: "<15k", label: "Under ₹15k" },
  { value: "15k-25k", label: "₹15k–₹25k" },
  { value: "25k-40k", label: "₹25k–₹40k" },
  { value: "40k+", label: "₹40k+" },
];

const reasonOptions = [
  "No suitable jobs nearby",
  "Salary too low",
  "Skill mismatch",
  "Lack of experience",
  "Transportation / relocation issue",
  "Family responsibilities",
  "Pursuing higher education",
  "Preparing for competitive exams",
];

const steps = [
  { number: 1, label: "Status" },
  { number: 2, label: "Details" },
  { number: 3, label: "Proof" },
  { number: 4, label: "Done" },
];

const inputClass = "mt-2 h-12 w-full rounded-xl border border-navy-200 bg-white px-3.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10";

export function OutcomeUpdateWizard({ followupToken }: { followupToken?: string } = {}) {
  const { token } = useAuth();
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<WorkStatus | "">("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [startDate, setStartDate] = useState("");
  const [salaryRange, setSalaryRange] = useState<SalaryRange>("");
  const [businessName, setBusinessName] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [employeesCreated, setEmployeesCreated] = useState("");
  const [unemployedReason, setUnemployedReason] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "uploaded" | "failed">("idle");
  const [offlineSaved, setOfflineSaved] = useState(false);

  const validate = () => {
    if (step === 1 && !status) {
      setError("Choose the option that best describes your current situation.");
      return false;
    }
    if (step === 2) {
      if (status === "working" || status === "apprenticeship") {
        if (!company.trim() || !role.trim() || !startDate || !salaryRange) {
          setError("Please complete the required work details before continuing.");
          return false;
        }
      }
      if (status === "self_employed" && (!businessName.trim() || !monthlyRevenue || employeesCreated === "")) {
        setError("Please complete your self-employment details before continuing.");
        return false;
      }
      if (status === "not_working" && !unemployedReason) {
        setError("Choose the reason that best matches your situation.");
        return false;
      }
    }
    setError("");
    return true;
  };

  const salaryMidpoint: Record<Exclude<SalaryRange, "">, number> = {
    "<15k": 12000,
    "15k-25k": 20000,
    "25k-40k": 32000,
    "40k+": 45000,
  };

  const submitUpdate = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    setOfflineSaved(false);
    try {
      if (proof) setUploadState("uploading");
      const payload = {
        status: (status === "working" ? "employed" : status === "not_working" ? "seeking_job" : status) as "employed" | "apprenticeship" | "self_employed" | "seeking_job",
        organization: status === "self_employed" ? businessName : company || undefined,
        role: status === "self_employed" ? businessName : role || undefined,
        start_date: startDate || undefined,
        monthly_wage: salaryRange ? salaryMidpoint[salaryRange] : undefined,
        location: undefined,
        business_type: status === "self_employed" ? businessName : undefined,
        monthly_revenue: monthlyRevenue ? Number(monthlyRevenue) : undefined,
        employees_created: employeesCreated !== "" ? Number(employeesCreated) : undefined,
        exit_reason: status === "not_working" ? unemployedReason : undefined,
        proof_file: proof,
      };
      const isLiveToken = token && !token.startsWith("demo-");
      if (!isLiveToken) throw new ApiError("offline");
      await api.submitOutcome(payload, token, followupToken);
      setUploadState(proof ? "uploaded" : "idle");
      try {
        window.localStorage.setItem("skilltrace.trainee-update.v1", "submitted");
      } catch {
        // The update still succeeds when local storage is unavailable.
      }
      setSubmitted(true);
      setStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      if (proof) setUploadState("failed");
      if (caught instanceof ApiError && (isOfflineError(caught) || caught.message === "offline")) {
        // Graceful offline mode: keep the draft locally and say so explicitly.
        // Do NOT set the "submitted" flag: the dashboard banner must only
        // reflect a confirmed backend write.
        try {
          window.localStorage.removeItem("skilltrace.trainee-update.v1");
          window.localStorage.setItem("skilltrace.outcome-draft.v1", JSON.stringify({
            status, company, role, startDate, salaryRange, businessName,
            monthlyRevenue, employeesCreated, unemployedReason,
          }));
        } catch { /* ignore */ }
        setOfflineSaved(true);
        setSubmitted(true);
        setStep(4);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Submission failed. Please check your details and retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueStep = () => {
    if (!validate()) return;
    if (step < 3) {
      setStep((current) => current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    void submitUpdate();
  };

  const previousStep = () => {
    setError("");
    setStep((current) => Math.max(1, current - 1));
  };

  const validateProof = (file?: File) => {
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setError("Please upload a PDF, JPG or PNG file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("The proof file must be smaller than 5 MB.");
      return;
    }
    setError("");
    setProof(file);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    validateProof(event.dataTransfer.files[0]);
  };

  return (
    <AppShell role="trainee" title="Update employment status" subtitle="A quick, low-burden outcome update" maxWidth="narrow">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-600 text-white"><Sparkles className="size-5" /></div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-navy-900">Tell us what’s changed</h1>
            <p className="mt-1 text-xs leading-5 text-navy-500">Your answers improve training programmes for future learners. Most people finish in under 30 seconds.</p>
          </div>
        </div>

        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-navy-100 px-5 py-5 sm:px-7">
            <div className="relative grid grid-cols-4">
              <div className="absolute left-[12.5%] right-[12.5%] top-4 h-0.5 bg-navy-100" aria-hidden="true" />
              <div className="absolute left-[12.5%] top-4 h-0.5 bg-primary-600 transition-all" style={{ width: `${((Math.max(0, step - 1)) / 3) * 75}%` }} aria-hidden="true" />
              {steps.map((item) => {
                const complete = item.number < step;
                const active = item.number === step;
                return (
                  <div key={item.number} className="relative z-10 flex flex-col items-center">
                    <span className={cn("grid size-8 place-items-center rounded-full border-[3px] border-white text-[10px] font-extrabold shadow-sm", complete ? "bg-primary-600 text-white" : active ? "bg-warning-500 text-navy-900 ring-4 ring-warning-100" : "bg-navy-100 text-navy-400")}>
                      {complete ? <Check className="size-3.5" /> : item.number}
                    </span>
                    <span className={cn("mt-2 text-[9px] font-extrabold", active ? "text-navy-900" : "text-navy-400")}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-h-[470px] p-5 sm:p-7">
            {step === 1 && (
              <div className="animate-fade-up">
                <Badge tone="blue">Step 1 of 4</Badge>
                <h2 className="mt-4 text-xl font-extrabold tracking-tight text-navy-900">Are you currently working?</h2>
                <p className="mt-2 text-xs leading-5 text-navy-500">Choose the answer that is closest. You can update again whenever your situation changes.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {statusOptions.map((option) => {
                    const selected = status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => { setStatus(option.value); setError(""); }}
                        className={cn("relative flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition", selected ? "border-primary-500 bg-primary-50 ring-4 ring-primary-500/10" : "border-navy-200 bg-white hover:border-primary-300 hover:bg-primary-50/30")}
                        aria-pressed={selected}
                      >
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", selected ? "bg-primary-600 text-white" : "bg-navy-100 text-navy-600")}><option.icon className="size-[18px]" /></span>
                        <span>
                          <span className="block text-sm font-extrabold text-navy-900">{option.title}</span>
                          <span className="mt-1.5 block text-[10px] leading-5 text-navy-500">{option.description}</span>
                        </span>
                        <span className={cn("absolute right-3 top-3 grid size-5 place-items-center rounded-full border", selected ? "border-primary-600 bg-primary-600 text-white" : "border-navy-200")}>
                          {selected && <Check className="size-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (status === "working" || status === "apprenticeship") && (
              <div className="animate-fade-up">
                <Badge tone="blue">Step 2 of 4</Badge>
                <h2 className="mt-4 text-xl font-extrabold tracking-tight text-navy-900">{status === "apprenticeship" ? "Tell us about your apprenticeship" : "Tell us about your current work"}</h2>
                <p className="mt-2 text-xs leading-5 text-navy-500">Only share details you are comfortable using for outcome verification.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-[11px] font-extrabold text-navy-700">{status === "apprenticeship" ? "Training organisation" : "Company name"} *</span>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3.5 top-[34px] size-4 text-navy-300" />
                      <input value={company} onChange={(event) => setCompany(event.target.value)} className={cn(inputClass, "pl-10")} placeholder={status === "apprenticeship" ? "e.g. Maharashtra Skill Academy" : "e.g. ABC Manufacturing Pvt. Ltd."} />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-extrabold text-navy-700">Job role *</span>
                    <input value={role} onChange={(event) => setRole(event.target.value)} className={inputClass} placeholder="e.g. CNC Programmer" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-extrabold text-navy-700">Start date *</span>
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
                  </label>
                  <fieldset className="sm:col-span-2">
                    <legend className="text-[11px] font-extrabold text-navy-700">Monthly salary range *</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {salaryOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSalaryRange(option.value)}
                          className={cn("h-11 rounded-xl border text-[11px] font-extrabold transition", salaryRange === option.value ? "border-primary-500 bg-primary-600 text-white" : "border-navy-200 bg-white text-navy-600 hover:border-primary-300")}
                          aria-pressed={salaryRange === option.value}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>
            )}

            {step === 2 && status === "self_employed" && (
              <div className="animate-fade-up">
                <Badge tone="blue">Step 2 of 4</Badge>
                <h2 className="mt-4 text-xl font-extrabold tracking-tight text-navy-900">Tell us about your work</h2>
                <p className="mt-2 text-xs leading-5 text-navy-500">Your livelihood counts just as much as a formal job.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-[11px] font-extrabold text-navy-700">Business / gig name *</span>
                    <div className="relative"><Store className="pointer-events-none absolute left-3.5 top-[34px] size-4 text-navy-300" /><input value={businessName} onChange={(event) => setBusinessName(event.target.value)} className={cn(inputClass, "pl-10")} placeholder="e.g. Neha Stitch Studio" /></div>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-extrabold text-navy-700">Monthly revenue *</span>
                    <input type="number" min={0} inputMode="numeric" value={monthlyRevenue} onChange={(event) => setMonthlyRevenue(event.target.value)} className={inputClass} placeholder="e.g. 25000" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-extrabold text-navy-700">Number of employees created *</span>
                    <div className="relative"><UsersRound className="pointer-events-none absolute left-3.5 top-[34px] size-4 text-navy-300" /><input type="number" min={0} inputMode="numeric" value={employeesCreated} onChange={(event) => setEmployeesCreated(event.target.value)} className={cn(inputClass, "pl-10")} placeholder="e.g. 2" /></div>
                  </label>
                </div>
              </div>
            )}

            {step === 2 && status === "not_working" && (
              <div className="animate-fade-up">
                <Badge tone="blue">Step 2 of 4</Badge>
                <h2 className="mt-4 text-xl font-extrabold tracking-tight text-navy-900">What is the main reason?</h2>
                <p className="mt-2 text-xs leading-5 text-navy-500">This helps providers improve support. It does not reduce the value of your training record.</p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {reasonOptions.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => { setUnemployedReason(reason); setError(""); }}
                      className={cn("flex min-h-12 items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[11px] font-bold transition", unemployedReason === reason ? "border-primary-500 bg-primary-50 text-primary-800 ring-2 ring-primary-500/10" : "border-navy-200 text-navy-600 hover:border-primary-300")}
                      aria-pressed={unemployedReason === reason}
                    >
                      {reason}
                      <span className={cn("ml-3 grid size-5 shrink-0 place-items-center rounded-full border", unemployedReason === reason ? "border-primary-600 bg-primary-600 text-white" : "border-navy-200")}>
                        {unemployedReason === reason && <Check className="size-3" />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-up">
                <Badge tone="blue">Step 3 of 4</Badge>
                <h2 className="mt-4 text-xl font-extrabold tracking-tight text-navy-900">Add proof <span className="font-semibold text-navy-400">(optional)</span></h2>
                <p className="mt-2 text-xs leading-5 text-navy-500">An appointment letter, ID card or pay slip can help an employer verify faster. You can submit without it.</p>
                <label
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={onDrop}
                  className="mt-6 grid min-h-60 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-navy-200 bg-soft-slate p-6 text-center transition hover:border-primary-400 hover:bg-primary-50/40"
                >
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(event) => validateProof(event.target.files?.[0])} />
                  {proof ? (
                    <div className="w-full max-w-sm">
                      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-50 text-primary-700"><FileText className="size-6" /></div>
                      <p className="mt-4 truncate text-sm font-extrabold text-navy-900">{proof.name}</p>
                      <p className="mt-1 text-[10px] text-navy-400">{(proof.size / 1024 / 1024).toFixed(2)} MB · {uploadState === "uploading" ? "Uploading…" : uploadState === "uploaded" ? "Uploaded" : uploadState === "failed" ? "Upload failed — will retry on submit" : "Ready to attach"}</p>
                      <Button type="button" variant="ghost" size="sm" className="mt-3 text-red-600" onClick={(event) => { event.preventDefault(); setProof(null); }}><Trash2 className="size-3.5" /> Remove file</Button>
                    </div>
                  ) : (
                    <div>
                      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-50 text-primary-700"><UploadCloud className="size-6" /></div>
                      <p className="mt-4 text-sm font-extrabold text-navy-900">Drop a file here, or browse</p>
                      <p className="mt-1 text-[10px] text-navy-400">PDF, JPG or PNG · maximum 5 MB</p>
                      <Badge tone="green" className="mx-auto mt-4"><ShieldCheck className="size-3" /> Private and consent-based</Badge>
                    </div>
                  )}
                </label>
                <div className="mt-5 flex gap-3 rounded-xl bg-primary-50 p-4">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-700" />
                  <p className="text-[10px] leading-5 text-navy-600">Your document is optional. It will only be used to confirm the outcome you chose to share.</p>
                </div>
              </div>
            )}

            {step === 4 && submitted && (
              <div className="grid min-h-[430px] place-items-center py-8 text-center animate-fade-up">
                <div className="max-w-lg">
                  <div className="relative mx-auto grid size-20 place-items-center rounded-full bg-emerald-50 text-success-600">
                    <CheckCircle2 className="size-10 animate-scale-in" />
                    <span className="absolute inset-0 animate-pulse-soft rounded-full border-2 border-emerald-200" />
                  </div>
                  <Badge tone="green" className="mx-auto mt-6" dot>Update complete</Badge>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-navy-900">Status Updated!</h2>
                  <p className="mt-3 text-sm leading-6 text-navy-500">{offlineSaved ? "Backend was unreachable, so your update was saved on this device as DEMO/OFFLINE data. It will sync when you are back online." : "Thank you for updating your information. This helps improve training programmes for future students."}</p>
                  <div className="mt-6 rounded-2xl border border-navy-100 bg-soft-slate p-4 text-left">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg bg-success-50 text-success-600"><ShieldCheck className="size-4" /></div>
                      <div>
                        <p className="text-xs font-extrabold text-navy-900">What happens next?</p>
                        <p className="mt-0.5 text-[10px] text-navy-400">A matching employer may be asked to confirm the outcome.</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[9px] font-extrabold text-navy-500">
                      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">1 · Submitted</div>
                      <div className="rounded-lg bg-white p-2">2 · Verify</div>
                      <div className="rounded-lg bg-white p-2">3 · Passport</div>
                    </div>
                  </div>
                  <Link href="/trainee/dashboard" className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-xs font-extrabold text-white transition hover:bg-primary-700">
                    Return to Home <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {step < 4 && (
            <div className="flex items-center justify-between gap-3 border-t border-navy-100 bg-soft-slate px-5 py-4 sm:px-7">
              <Button variant="ghost" onClick={previousStep} disabled={step === 1}><ArrowLeft className="size-4" /> Back</Button>
              <div className="text-right">
                <Button onClick={continueStep} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting…" : step === 3 ? "Submit update" : "Continue"} <ArrowRight className="size-4" />
                </Button>
                <p className="mt-1.5 hidden items-center justify-end gap-1 text-[9px] text-navy-400 sm:flex"><Clock3 className="size-3" /> About 30 seconds</p>
              </div>
            </div>
          )}
        </Card>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold text-red-700" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
          </div>
        )}
      </div>
    </AppShell>
  );
}
