"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { demoUsers } from "@/lib/demo-data";
import type { UserRole } from "@/lib/types";
import { getDashboardRoute } from "@/lib/types";
import { cn } from "@/lib/utils";

const roles: Array<{
  id: UserRole;
  title: string;
  subtitle: string;
  email: string;
  path: string;
  icon: typeof GraduationCap;
  tone: string;
}> = [
  {
    id: "trainee",
    title: "Trainee",
    subtitle: "Passport & updates",
    email: "trainee@skilltrace.in",
    path: "/trainee",
    icon: GraduationCap,
    tone: "bg-saffron-soft text-[#91540C]",
  },
  {
    id: "employer",
    title: "Employer",
    subtitle: "Verification desk",
    email: "employer@skilltrace.in",
    path: "/employer",
    icon: Building2,
    tone: "bg-teal-soft text-teal",
  },
  {
    id: "admin",
    title: "Government",
    subtitle: "Outcome intelligence",
    email: "admin@skilltrace.in",
    path: "/dashboard",
    icon: BarChart3,
    tone: "bg-sky-50 text-sky-700",
  },
];

export function LoginExperience({ initialRole = "trainee", postLoginPath }: { initialRole?: UserRole; postLoginPath?: string }) {
  const router = useRouter();
  const { login, loginAsDemo, isSubmitting, error, clearError, user, logout, isDemoSession } = useAuth();
  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState(demoUsers[initialRole].email);
  const [password, setPassword] = useState("Demo@123");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setRole(initialRole);
    setEmail(demoUsers[initialRole].email);
    setPassword("Demo@123");
    clearError();
  }, [initialRole, clearError]);

  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setEmail(demoUsers[nextRole].email);
    setPassword("Demo@123");
    setLocalError(null);
    clearError();
  };

  const handleSubmit = async (event: FormEvent) => {
    console.debug("[LOGIN DEBUG] form submit fired");
    event.preventDefault();
    console.debug("[LOGIN DEBUG] selected role:", role);
    console.debug("[LOGIN DEBUG] email:", email);
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError("Enter both an email address and password.");
      return;
    }
    console.debug("[LOGIN DEBUG] validation passed");
    try {
      // The backend JWT determines the role; the UI selector is only a hint.
      console.debug("[LOGIN DEBUG] calling api.login");
      const authenticated = await login({ email: email.trim(), password, role });
      console.debug("[LOGIN DEBUG] api.login returned");
      console.debug("[LOGIN DEBUG] backend role:", authenticated.role);
      const destination = authenticated.role === "trainee" && postLoginPath
        ? postLoginPath
        : getDashboardRoute(authenticated.role);
      console.debug("[LOGIN DEBUG] redirect destination:", destination);
      router.push(destination);
    } catch (caught) {
      // Surface the backend reason (e.g. "Incorrect email or password").
      setLocalError(caught instanceof Error ? caught.message : "Unable to sign in. Please try again.");
    }
  };

  const quickDemo = async () => {
    setLocalError(null);
    try {
      // Real backend login with the seeded demo account for the selected role.
      const authenticated = await loginAsDemo(role);
      router.push(authenticated.role === "trainee" && postLoginPath
        ? postLoginPath
        : getDashboardRoute(authenticated.role));
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Unable to sign in. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-ivory lg:grid lg:grid-cols-[.92fr_1.08fr]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-navy p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="dark-grid absolute inset-0 opacity-[0.14]" />
        <div className="absolute -right-48 top-16 size-[520px] rounded-full border border-teal-300/10" />
        <div className="absolute -right-24 top-40 size-[330px] rounded-full border border-saffron/10" />
        <div className="absolute -bottom-40 -left-24 size-96 rounded-full bg-teal/10 blur-3xl" />
        <div className="relative">
          <Brand inverse />
        </div>

        <div className="relative my-auto max-w-xl py-16">
          <Badge tone="amber" dot>Maharashtra outcomes prototype</Badge>
          <h1 className="mt-7 text-balance font-display text-5xl font-semibold leading-[1.02] tracking-[-0.045em] xl:text-6xl">
            One trusted sign-in.<br />Three ways to act.
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-white/50">
            Follow a learner’s progress, strengthen employer evidence, or turn outcomes into public decisions.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              ["1.24L+", "Trained"],
              ["86k", "Placed"],
              ["68%", "6M retained"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="font-display text-2xl font-semibold text-saffron">{value}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-white/35">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/6 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-teal-soft text-teal"><ShieldCheck className="size-5" /></div>
              <div>
                <p className="text-xs font-bold">Backend-verified authentication</p>
                <p className="mt-1 text-[10px] leading-4 text-white/40">Sign-in is validated by the SkillTrace API and your role comes from your account.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between border-t border-white/10 pt-6 text-[10px] text-white/30">
          <span>SkillTrace · Public outcomes infrastructure</span>
          <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3" /> Consent-led</span>
        </div>
      </aside>

      <main id="main-content" className="relative flex min-h-screen flex-col">
        <header className="flex h-[72px] items-center justify-between border-b border-navy/8 px-5 sm:px-8 lg:px-10">
          <div className="lg:hidden"><Brand /></div>
          <Link href="/" className="ml-auto inline-flex items-center gap-2 text-xs font-bold text-navy/50 transition hover:text-teal">
            <ArrowLeft className="size-4" /> Back to public site
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:px-10">
          <div className="w-full max-w-2xl">
            <div className="text-center">
              <Badge tone="teal" dot>Role access</Badge>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-navy sm:text-5xl">Welcome to SkillTrace</h2>
              <p className="mt-3 text-sm leading-6 text-navy/50">Choose a workspace. Demo credentials are ready for judges.</p>
            </div>

            {user && (
              <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-600/15 bg-emerald-50 p-4 sm:flex-row sm:items-center">
                <div className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Check className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-navy">Signed in as {user.name}</p>
                  <p className="mt-0.5 text-[10px] text-navy/45">{isDemoSession ? "Local demo session" : user.email} · {user.role === "admin" ? "Government" : user.role}</p>
                </div>
                <Link href={getDashboardRoute(user.role)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-teal px-3.5 text-[11px] font-bold text-white transition hover:bg-[#086a66]">
                  Open workspace <ArrowRight className="size-3.5" />
                </Link>
                <button onClick={logout} className="text-[10px] font-bold text-coral hover:underline">Sign out</button>
              </div>
            )}

            <div className="mt-7 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Choose demo role">
              {roles.map((item) => {
                const Icon = item.icon;
                const selected = role === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectRole(item.id)}
                    className={cn(
                      "relative rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/10",
                      selected ? "border-teal bg-teal-soft/40 shadow-sm" : "border-navy/10 bg-paper hover:border-teal/25",
                    )}
                  >
                    {selected && <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-teal text-white"><Check className="size-3" /></span>}
                    <span className={cn("grid size-9 place-items-center rounded-xl", item.tone)}><Icon className="size-4" /></span>
                    <span className="mt-3 block text-xs font-bold text-navy">{item.title}</span>
                    <span className="mt-0.5 block text-[10px] text-navy/40">{item.subtitle}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 rounded-3xl border border-navy/10 bg-paper p-5 shadow-card sm:p-7" noValidate>
              <div className="flex items-center gap-3 border-b border-navy/8 pb-5">
                <div className="grid size-10 place-items-center rounded-2xl bg-navy text-saffron"><KeyRound className="size-5" /></div>
                <div>
                  <h3 className="text-sm font-bold text-navy">Sign in to {roles.find((item) => item.id === role)?.title}</h3>
                  <p className="mt-0.5 text-[10px] text-navy/40">Use the prefilled credentials or the real API.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-xs font-bold text-navy/70">Email address</span>
                  <span className="relative mt-2 block">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-navy/30" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-12 w-full rounded-xl border border-navy/12 bg-white pl-10 pr-3 text-sm text-navy outline-none transition placeholder:text-navy/30 focus:border-teal focus:ring-4 focus:ring-teal/10"
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="flex items-center justify-between text-xs font-bold text-navy/70"><span>Password</span><span className="text-[10px] font-semibold text-teal">Demo@123</span></span>
                  <span className="relative mt-2 block">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-navy/30" />
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-12 w-full rounded-xl border border-navy/12 bg-white pl-10 pr-11 text-sm text-navy outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10"
                    />
                    <button type="button" onClick={() => setShowPassword((show) => !show)} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-navy/30 hover:bg-navy/5 hover:text-navy" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </span>
                </label>
              </div>

              {(error || localError) && (
                <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">{localError || error}</p>
              )}

              <Button type="submit" size="lg" loading={isSubmitting} className="mt-6 w-full">
                {isSubmitting ? "Opening workspace…" : "Sign in securely"} <ArrowRight className="size-4" />
              </Button>

              <div className="my-5 flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.13em] text-navy/25">
                <span className="h-px flex-1 bg-navy/8" /> or <span className="h-px flex-1 bg-navy/8" />
              </div>

              <Button type="button" variant="outline" size="lg" onClick={quickDemo} disabled={isSubmitting} className="w-full">
                <Sparkles className="size-4 text-saffron" /> Enter {roles.find((item) => item.id === role)?.title} demo
              </Button>

              <p className="mt-4 text-center text-[10px] leading-4 text-navy/35">By continuing, you agree to use consented outcome data in line with the prototype privacy principles.</p>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-navy/35">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3 text-teal" /> Role-based access</span>
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3 text-teal" /> Local session storage</span>
              <Link href="/" className="font-bold text-teal hover:underline">Explore without signing in</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
