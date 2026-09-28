"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Globe2,
  GraduationCap,
  Handshake,
  Languages,
  LockKeyhole,
  MapPin,
  Menu,
  Route,
  ShieldCheck,
  Sparkles,
  Sprout,
  Target,
  TrendingUp,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { landingCopy, languageLabels } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Language = "en" | "mr" | "hi";

const roleCards = [
  {
    key: "trainee",
    href: "/login?role=trainee",
    eyebrow: "For trainees",
    icon: GraduationCap,
    tone: "blue",
  },
  {
    key: "employer",
    href: "/login?role=employer",
    eyebrow: "For employers",
    icon: Building2,
    tone: "green",
  },
  {
    key: "admin",
    href: "/login?role=admin",
    eyebrow: "For government & providers",
    icon: BarChart3,
    tone: "amber",
  },
] as const;

const processSteps = [
  { number: "01", title: "Training & Certification", body: "Verified course completion and portable skill credentials.", icon: BookOpenCheck, metric: "Skills documented" },
  { number: "02", title: "Placement & Employment", body: "Consent-based updates connect training to real roles.", icon: BriefcaseBusiness, metric: "Placement tracked" },
  { number: "03", title: "Retention & Wage Growth", body: "Follow outcomes at 3, 6 and 12 months—not just the first job.", icon: TrendingUp, metric: "Growth measured" },
  { number: "04", title: "Skill Gap & Policy Insights", body: "Compare regional supply and employer demand to guide the next cohort.", icon: Target, metric: "Action informed" },
];

function RoleLoginMenu({ label = "Sign in" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const roles = [
    { label: "Trainee", href: "/login?role=trainee", icon: GraduationCap },
    { label: "Employer", href: "/login?role=employer", icon: Building2 },
    { label: "Government Admin", href: "/login?role=admin", icon: ShieldCheck },
  ];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/25" aria-expanded={open} aria-haspopup="menu">
        {label} <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-navy-200 bg-white p-1.5 shadow-lift">
          <p className="px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-navy-400">Choose your role</p>
          {roles.map((role) => (
            <Link key={role.label} href={role.href} role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-navy-700 transition hover:bg-primary-50 hover:text-primary-700">
              <role.icon className="size-4 text-primary-600" /> {role.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (value: Language) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navLinks = [["Home", "#home"], ["About", "#about"], ["Features", "#features"], ["Impact", "#impact"], ["Contact", "#contact"]] as const;
  return (
    <header className="sticky top-0 z-50 border-b border-navy-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <Brand showDescriptor />
        <nav className="ml-auto hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          {navLinks.map(([label, href]) => <a key={href} href={href} className="text-xs font-bold text-navy-600 transition hover:text-primary-600">{label}</a>)}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:ml-8 lg:flex">
          <label className="relative">
            <span className="sr-only">Choose language</span>
            <Languages className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-navy-400" />
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="h-10 appearance-none rounded-xl border border-navy-200 bg-white pl-8 pr-8 text-[11px] font-bold text-navy-700 outline-none transition hover:border-primary-300 focus:border-primary-500">
              <option value="en">{languageLabels.en}</option><option value="mr">{languageLabels.mr}</option><option value="hi">{languageLabels.hi}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-navy-400" />
          </label>
          <RoleLoginMenu label="Login" />
        </div>
        <button type="button" onClick={() => setMobileOpen((value) => !value)} className="ml-auto grid size-10 place-items-center rounded-xl border border-navy-200 text-navy-700 lg:hidden" aria-expanded={mobileOpen} aria-controls="mobile-menu" aria-label={mobileOpen ? "Close navigation" : "Open navigation"}>
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {mobileOpen && (
        <div id="mobile-menu" className="border-t border-navy-200 bg-white px-4 py-4 lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-1" aria-label="Mobile navigation">
            {navLinks.map(([label, href]) => <a key={href} href={href} onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-bold text-navy-600 hover:bg-primary-50 hover:text-primary-700">{label}</a>)}
            <div className="mt-3 flex items-center gap-2 border-t border-navy-100 pt-4">
              <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="h-11 flex-1 rounded-xl border border-navy-200 bg-white px-3 text-sm font-bold text-navy-700" aria-label="Choose language">
                <option value="en">{languageLabels.en}</option><option value="mr">{languageLabels.mr}</option><option value="hi">{languageLabels.hi}</option>
              </select>
              <RoleLoginMenu label="Login" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function JourneyGraphic() {
  const stages = [
    { label: "Skills Today", sub: "CNC certified", icon: Wrench, color: "text-primary-300", bg: "bg-primary-500/15" },
    { label: "Jobs Tomorrow", sub: "Placement verified", icon: BriefcaseBusiness, color: "text-warning-300", bg: "bg-warning-500/15" },
    { label: "Better Livelihoods", sub: "Wages growing", icon: Sprout, color: "text-success-500", bg: "bg-success-500/15" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:ml-auto">
      <div className="absolute -left-10 top-8 size-32 rounded-full bg-primary-500/20 blur-3xl" />
      <div className="absolute -bottom-8 right-2 size-40 rounded-full bg-success-500/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-4 shadow-panel backdrop-blur-sm sm:p-6">
        <div className="dark-grid absolute inset-0 opacity-35" />
        <div className="relative flex items-center justify-between">
          <div><p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-white/40">Trainee outcome journey</p><p className="mt-1 text-sm font-bold text-white">A visible path from learning to livelihood</p></div>
          <Badge className="bg-success-500/15 text-success-500 ring-success-500/20" dot>On track</Badge>
        </div>
        <div className="relative mt-7 overflow-hidden rounded-2xl border border-white/10 bg-navy-900/55 px-4 py-5 sm:px-6">
          <svg className="absolute inset-x-8 top-10 h-24 w-[calc(100%-4rem)]" viewBox="0 0 440 90" fill="none" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="journey-gradient" x1="20" y1="65" x2="420" y2="25"><stop stopColor="#0B7A75" /><stop offset="0.55" stopColor="#E99024" /><stop offset="1" stopColor="#D85C4A" /></linearGradient></defs>
            <path d="M20 65 C95 65 90 20 165 20 S245 70 315 58 S365 20 420 25" stroke="rgba(96,165,250,.25)" strokeWidth="2" strokeDasharray="4 7" />
            <path d="M20 65 C95 65 90 20 165 20 S245 70 315 58 S365 20 420 25" stroke="url(#journey-gradient)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <div className="relative grid grid-cols-3 gap-2">
            {stages.map((stage) => (
              <div key={stage.label} className="text-center">
                <div className={cn("mx-auto grid size-12 place-items-center rounded-2xl border border-white/10 sm:size-14", stage.bg)}><stage.icon className={cn("size-5 sm:size-6", stage.color)} /></div>
                <p className="mt-3 text-[10px] font-extrabold text-white sm:text-xs">{stage.label}</p>
                <p className="mt-1 hidden text-[9px] text-white/40 sm:block">{stage.sub}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          {[["320 hrs", "Training"], ["87%", "Skill match"], ["₹24.5k", "Monthly wage"]].map(([value, label]) => (
            <div key={label} className="rounded-xl bg-white/[0.055] px-2 py-3 ring-1 ring-inset ring-white/[0.06]"><p className="text-sm font-extrabold text-white">{value}</p><p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-white/35">{label}</p></div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-4 -left-3 hidden items-center gap-3 rounded-xl border border-navy-200 bg-white p-3 pr-5 shadow-lift sm:flex">
        <div className="grid size-9 place-items-center rounded-lg bg-success-50 text-success-600"><BadgeCheck className="size-4" /></div>
        <div><p className="text-[9px] font-extrabold uppercase tracking-wider text-navy-400">Outcome confidence</p><p className="mt-0.5 text-xs font-extrabold text-navy-900">High · Verified</p></div>
      </div>
    </div>
  );
}

export function LandingExperience() {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("skilltrace.language");
      if (stored && (stored === "en" || stored === "mr" || stored === "hi")) {
        return stored as Language;
      }
    }
    return "en";
  });
  const [activeStep, setActiveStep] = useState(0);
  const copy = landingCopy[language];
  const text = {
    eyebrow: copy.eyebrow,
    title: copy.heroTitle,
    body: copy.heroBody,
    primary: copy.traineeCta,
    secondary: copy.governmentCta,
  };
  const localizedRoles = roleCards.map((role) => ({
    ...role,
    title: role.key === "trainee" ? copy.roles.trainee : role.key === "employer" ? copy.roles.employer : copy.roles.government,
    body: role.key === "trainee" ? copy.roles.traineeBody : role.key === "employer" ? copy.roles.employerBody : copy.roles.governmentBody,
  }));
  const localizedPillars = [
    { icon: LockKeyhole, title: copy.pillars.privacy.title, subtitle: "Consent-based", body: copy.pillars.privacy.body },
    { icon: Languages, title: copy.pillars.language.title, subtitle: "English · मराठी · हिंदी", body: copy.pillars.language.body },
    { icon: Route, title: copy.pillars.vision.title, subtitle: "Aligned with Maharashtra Skilling Vision", body: copy.pillars.vision.body },
  ];
  const activeProcess = processSteps[activeStep];
  useEffect(() => { 
    document.documentElement.lang = language; 
    window.localStorage.setItem("skilltrace.language", language);
  }, [language]);

  return (
    <div className="min-h-screen overflow-hidden bg-white text-navy-900">
      <Header language={language} setLanguage={setLanguage} />
      <main id="main-content">
        <section id="home" className="relative overflow-hidden bg-navy-900 text-white">
          <div className="dark-grid absolute inset-0 opacity-40" /><div className="absolute inset-0 bg-soft-radial opacity-70" />
          <div className="absolute -right-32 top-0 size-96 rounded-full border border-primary-400/10" /><div className="absolute -right-12 top-20 size-64 rounded-full border border-primary-400/10" />
          <div className="relative mx-auto grid max-w-7xl gap-16 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:px-8 lg:py-24">
            <div className="max-w-3xl animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary-200"><span className="size-1.5 rounded-full bg-success-500" />{text.eyebrow}</div>
              <h1 className="mt-7 text-balance text-5xl font-extrabold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-[4.6rem]">
                {text.title}<span className="mt-2 block font-display text-[0.78em] font-semibold italic text-saffron">{copy.heroAccent}</span>
              </h1>
              <p className="pretty-text mt-7 max-w-2xl text-base leading-8 text-white/62 sm:text-lg">{text.body}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/login?role=trainee" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-saffron px-5 text-sm font-bold text-navy shadow-[0_14px_30px_-14px_rgba(233,144,36,.7)] transition hover:-translate-y-0.5 hover:bg-saffron-500"><CircleUserRound className="size-[18px]" />{text.primary}</Link>
                <Link href="/login?role=admin" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10">{text.secondary}<ArrowRight className="size-4" /></Link>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-5">
                {[copy.proofOne, copy.proofTwo, copy.proofThree].map((item) => <span key={item} className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/48"><CheckCircle2 className="size-3.5 text-saffron" />{item}</span>)}
              </div>
            </div>
            <div className="animate-fade-up [animation-delay:120ms]"><JourneyGraphic /></div>
          </div>
          <div className="relative border-t border-white/10 bg-white/[0.035]">
            <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/10 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
              {[["1,24,560", "People trained"], ["86,230", "Placements"], ["68%", "6M retention"], ["36", "Districts enabled"]].map(([value, label]) => (
                <div key={label} className="px-3 py-5 sm:px-5"><p className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">{label}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="py-20 sm:py-24">
          <div id="journey" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary-600">{copy.journey.eyebrow}</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-[-0.04em] text-navy-900 sm:text-5xl">{copy.contextTitle}</h2>
              <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-navy-500 sm:text-base">{copy.contextBody}</p>
            </div>
            <div className="relative mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="absolute left-[12%] right-[12%] top-9 hidden border-t-2 border-dashed border-primary-100 lg:block" aria-hidden="true" />
              {processSteps.map((step, index) => {
                const active = index === activeStep;
                return (
                  <button
                    key={step.number}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    aria-pressed={active}
                    className={cn("relative rounded-2xl border bg-white p-5 text-left shadow-card transition hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/15", active ? "border-primary-500 ring-2 ring-primary-500/15" : "border-navy-200 hover:border-primary-200")}
                  >
                    <div className="relative z-10 flex items-center justify-between"><div className={cn("grid size-14 place-items-center rounded-2xl ring-8 ring-white", active ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-700")}><step.icon className="size-6" /></div><span className="text-xs font-extrabold text-navy-200">{step.number}</span></div>
                    <h3 className="mt-6 text-base font-extrabold tracking-tight text-navy-900">{step.title}</h3>
                    <p className="mt-2 text-xs leading-6 text-navy-500">{step.body}</p>
                    <p className="mt-5 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-success-600"><CheckCircle2 className="size-3.5" />{step.metric}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 rounded-3xl border border-navy-100 bg-white p-5 shadow-card" aria-live="polite">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("grid size-11 place-items-center rounded-2xl", activeStep === 3 ? "bg-success-600 text-white" : "bg-primary-600 text-white")}><activeProcess.icon className="size-5" /></div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-navy-400">Stage {activeProcess.number} · {activeProcess.metric}</p>
                    <p className="mt-1 text-sm font-extrabold text-navy">{copy.journey.body}</p>
                  </div>
                </div>
                <Badge tone={activeStep === 3 ? "green" : "blue"}>{activeStep === 3 ? "Sustained outcomes" : "Shared evidence"}</Badge>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-navy-100">
                <div className="h-full rounded-full bg-primary-600 transition-all duration-500" style={{ width: `${(activeStep / 3) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[9px] font-bold uppercase tracking-wider text-navy-400"><span>{copy.journey.progress}</span><span>{Math.round((activeStep / 3) * 100)}%</span></div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-navy-200 bg-soft-slate py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary-600">{copy.pillars.eyebrow}</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-navy-900 sm:text-4xl">{copy.pillars.title}</h2></div><p className="max-w-md text-sm leading-6 text-navy-500">{copy.pillars.body}</p></div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {localizedRoles.map((role) => (
                <Link key={role.eyebrow} href={role.href} className="group relative overflow-hidden rounded-2xl border border-navy-200 bg-white p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lift sm:p-7">
                  <div className={cn("absolute inset-x-0 top-0 h-1", role.tone === "blue" ? "bg-primary-600" : role.tone === "green" ? "bg-success-500" : "bg-warning-500")} />
                  <div className="flex items-start justify-between gap-4">
                    <div className={cn("grid size-12 place-items-center rounded-xl", role.tone === "blue" ? "bg-primary-50 text-primary-700" : role.tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-warning-50 text-warning-700")}><role.icon className="size-5" /></div>
                    <span className="grid size-9 place-items-center rounded-full border border-navy-200 text-navy-400 transition group-hover:border-primary-200 group-hover:bg-primary-600 group-hover:text-white"><ArrowRight className="size-4 -rotate-45 transition group-hover:rotate-0" /></span>
                  </div>
                  <p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.13em] text-navy-400">{role.eyebrow}</p><h3 className="mt-2 text-xl font-extrabold tracking-tight text-navy-900">{role.title}</h3><p className="mt-3 min-h-12 text-sm leading-6 text-navy-500">{role.body}</p>
                  <div className="mt-6 flex items-center gap-1.5 border-t border-navy-100 pt-4 text-xs font-extrabold text-primary-600">{copy.roles.open}<ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid overflow-hidden rounded-2xl border border-navy-200 bg-white shadow-card md:grid-cols-3">
              {localizedPillars.map((item, index) => (
                <div key={item.title} className={cn("flex gap-4 p-6 sm:p-7", index < 2 && "border-b border-navy-100 md:border-b-0 md:border-r")}>
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700"><item.icon className="size-5" /></div>
                  <div><h3 className="text-sm font-extrabold text-navy-900">{item.title}</h3><p className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-primary-700">{item.subtitle}</p><p className="mt-2 text-xs leading-5 text-navy-500">{item.body}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="impact" className="relative overflow-hidden bg-navy py-20 text-white sm:py-24">
          <div className="dark-grid absolute inset-0 opacity-25" /><div className="absolute -right-28 -top-28 size-96 rounded-full border border-white/10" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:px-8">
            <div><Badge className="bg-white/10 text-primary-50 ring-white/15" dot>Impact through evidence</Badge><h2 className="mt-5 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Make every training investment count.</h2><p className="mt-5 text-sm leading-7 text-white/65">See which pathways lead to sustained work, which districts need support and where emerging skills are creating new opportunities.</p><Link href="/login?role=admin" className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-extrabold text-primary-700 shadow-sm transition hover:-translate-y-0.5">Explore live dashboard<ArrowRight className="size-4" /></Link></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[["+12.4%", "Placement lift", Handshake], ["₹3,200", "Median wage growth", TrendingUp], ["4,500", "EV skill gap", Sparkles]].map(([value, label, Icon]) => {
                const MetricIcon = Icon as typeof Handshake;
                return <div key={label as string} className="rounded-2xl border border-white/10 bg-white/[0.08] p-5 backdrop-blur-sm"><MetricIcon className="size-5 text-primary-100" /><p className="mt-8 text-2xl font-extrabold tracking-tight">{value as string}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/45">{label as string}</p></div>;
              })}
            </div>
          </div>
        </section>

        <section id="contact" className="bg-navy-900 py-12 text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div><Brand inverse /><p className="mt-4 max-w-xl text-xs leading-6 text-white/45">A consent-led outcomes infrastructure for stronger skills, sustainable work and better livelihoods across Maharashtra.</p></div>
            <div className="grid gap-3 text-xs sm:grid-cols-3"><div className="flex items-center gap-2 text-white/55"><MapPin className="size-4 text-success-500" />Maharashtra, India</div><div className="flex items-center gap-2 text-white/55"><Globe2 className="size-4 text-success-500" />English · मराठी · हिंदी</div><div className="flex items-center gap-2 text-white/55"><UsersRound className="size-4 text-success-500" />Public value, shared</div></div>
          </div>
          <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-2 border-t border-white/10 px-4 pt-6 text-[10px] text-white/30 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><p>© 2026 SkillTrace prototype. All data shown is illustrative.</p><p>Designed for accessible, inclusive skilling outcomes.</p></div>
        </section>
      </main>
    </div>
  );
}
