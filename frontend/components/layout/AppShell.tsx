"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  FileBadge,
  Home,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageCircleQuestion,
  Megaphone,
  ShieldCheck,
  Target,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useAuth } from "@/lib/auth";
import { demoUsers } from "@/lib/demo-data";
import type { UserRole } from "@/lib/types";
import { cn, getInitials } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: typeof Home };

const roleConfig: Record<
  UserRole,
  {
    label: string;
    workspace: string;
    title: string;
    path: string;
    icon: typeof FileBadge;
    sidebar: NavItem[];
    mobile: NavItem[];
  }
> = {
  trainee: {
    label: "Trainee",
    workspace: "My learning journey",
    title: "Trainee Portal",
    path: "/trainee",
    icon: FileBadge,
    sidebar: [
      { label: "Outcome Passport", href: "/trainee/dashboard", icon: Home },
      { label: "Update employment", href: "/trainee/update", icon: BriefcaseBusiness },
      { label: "Privacy & consent", href: "/trainee/consent", icon: LockKeyhole },
      { label: "Profile", href: "/trainee/profile", icon: UserRound },
    ],
    mobile: [
      { label: "Home", href: "/trainee/dashboard", icon: Home },
      { label: "Update", href: "/trainee/update", icon: BriefcaseBusiness },
      { label: "Privacy", href: "/trainee/consent", icon: ShieldCheck },
      { label: "Profile", href: "/trainee/profile", icon: UserRound },
    ],
  },
  employer: {
    label: "Employer",
    workspace: "ABC Manufacturing",
    title: "Employer Portal",
    path: "/employer",
    icon: ShieldCheck,
    sidebar: [
      { label: "Verification queue", href: "/employer/dashboard", icon: LayoutDashboard },
      { label: "Review request", href: "/employer/verify/VER-1002", icon: ShieldCheck },
      { label: "Verification guide", href: "/employer/dashboard#guide", icon: MessageCircleQuestion },
      { label: "Profile", href: "/employer/profile", icon: UserRound },
    ],
    mobile: [
      { label: "Queue", href: "/employer/dashboard", icon: LayoutDashboard },
      { label: "Review", href: "/employer/verify/VER-1002", icon: ShieldCheck },
      { label: "Guide", href: "/employer/dashboard#guide", icon: MessageCircleQuestion },
      { label: "Profile", href: "/employer/profile", icon: UserRound },
    ],
  },
  admin: {
    label: "Government Admin",
    workspace: "Maharashtra Skilling",
    title: "Government Dashboard",
    path: "/dashboard",
    icon: BarChart3,
    sidebar: [
      { label: "Outcome overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "District outcomes", href: "/dashboard#districts", icon: UsersRound },
      { label: "Skill gaps", href: "/dashboard#skill-gaps", icon: Target },
      { label: "Policy insights", href: "/dashboard#insights", icon: CheckCircle2 },
      { label: "Outreach", href: "/dashboard/outreach", icon: Megaphone },
      { label: "Reports & exports", href: "/dashboard#reports", icon: FileBadge },
    ],
    mobile: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Districts", href: "/dashboard#districts", icon: UsersRound },
      { label: "Skills", href: "/dashboard#skill-gaps", icon: Target },
      { label: "Insights", href: "/dashboard#insights", icon: CheckCircle2 },
    ],
  },
};

export function isNavigationActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  const cleanHref = href.split("#")[0];
  if (cleanHref === "/dashboard" || cleanHref === "/trainee" || cleanHref === "/employer") {
    return pathname === cleanHref;
  }
  return pathname.startsWith(cleanHref);
}

export interface AppShellProps {
  role: UserRole;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  flush?: boolean;
  maxWidth?: "default" | "narrow";
}

export function AppShell({
  role,
  title,
  subtitle,
  children,
  headerActions,
  flush = false,
  maxWidth = "default",
}: AppShellProps) {
  const pathname = usePathname();
  const config = roleConfig[role];
  const { user, token, isDemoSession, logout } = useAuth();
  const profile = user ?? demoUsers[role];
  const isLive = Boolean(token && !isDemoSession && !token.startsWith("demo-"));
  const isDemoAccount = Boolean(user?.email?.endsWith("@skilltrace.in"));
  const roleLabel = role === "admin" ? "Government" : role === "trainee" ? "Trainee" : "Employer";
  const profileHref =
    role === "trainee" ? "/trainee/profile" : role === "employer" ? "/employer/profile" : "/dashboard";

  return (
    <div className="min-h-screen bg-soft-slate text-navy-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-navy-900 focus:shadow-lift">
        Skip to content
      </a>

      <div className="bg-navy-900 text-white">
        <div className="mx-auto flex h-9 max-w-[1600px] items-center gap-3 overflow-x-auto px-3 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">
            <span className={cn("size-1.5 animate-pulse rounded-full", isLive ? "bg-emerald-400" : "bg-success-500")} /> {isLive ? "Live workspace" : "Demo workspace"}
          </div>
          <span className="ml-auto hidden shrink-0 text-[10px] text-white/35 md:block">{isLive ? "Live data · connected to SkillTrace API" : "Synthetic data · no backend required"}</span>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen w-[256px] flex-col overflow-hidden bg-navy-900 text-white lg:flex">
        <div className="dark-grid absolute inset-0 opacity-30" />
        <div className="absolute -left-24 top-32 size-64 rounded-full bg-primary-600/15 blur-3xl" />
        <div className="relative flex h-full flex-col">
          <div className="flex h-[76px] items-center border-b border-white/10 px-5"><Brand inverse href="/" /></div>
          <div className="px-4 pt-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-primary-600 text-white"><config.icon className="size-[18px]" /></div>
                <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{config.workspace}</p><p className="mt-0.5 text-[10px] text-white/40">{config.label} workspace</p></div>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 pt-6" aria-label={`${config.label} navigation`}>
            <p className="px-3 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/35">Workspace</p>
            <div className="mt-2 space-y-1">
              {config.sidebar.map((item) => {
                const active = isNavigationActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition", active ? "bg-white text-navy-900 shadow-sm" : "text-white/55 hover:bg-white/[0.07] hover:text-white")} aria-current={active ? "page" : undefined}>
                    <item.icon className={cn("size-[17px]", active ? "text-primary-600" : "text-white/40")} />{item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="p-4">
            <div className="mb-3 rounded-xl border border-success-500/20 bg-success-500/10 p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-success-200"><CheckCircle2 className="size-3.5" /> {isLive ? "Live data active" : "Demo data active"}</div>
              <p className="mt-1 text-[10px] leading-4 text-white/40">{isLive ? "Actions are saved to the SkillTrace backend." : "Actions are saved locally for this prototype."}</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-600 text-[10px] font-extrabold text-white">{getInitials(profile.name)}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{profile.name}</p><p className="truncate text-[10px] text-white/40">{config.label} workspace</p></div>
              <UserRound className="size-4 text-white/30" />
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 overflow-x-clip">
        <header className="sticky top-0 z-30 border-b border-navy-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex min-h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden"><Brand compact /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-extrabold tracking-[-0.025em] text-navy-900 sm:text-lg">{title ?? config.title}</h1>
                <span className="hidden rounded-full bg-primary-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-primary-700 sm:inline-flex">
                  {isDemoAccount ? `Demo · ${roleLabel}` : isLive ? "Live data" : "Live demo"}
                </span>
              </div>
              {subtitle && <p className="mt-0.5 hidden truncate text-[11px] text-navy-500 sm:block">{subtitle}</p>}
            </div>
            {headerActions}
            <NotificationBell />
            {user && (
              <button
                type="button"
                onClick={logout}
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-navy-200 bg-white text-navy-500 transition hover:border-red-200 hover:text-red-600"
                aria-label="Sign out and switch demo role"
                title="Sign out and switch demo role"
              >
                <LogOut className="size-[18px]" />
              </button>
            )}
            <Link href={profileHref} className="hidden items-center gap-2 rounded-xl border border-navy-200 bg-white py-1.5 pl-2 pr-3 transition hover:border-primary-200 sm:flex" aria-label="Your profile">
              <span className="grid size-7 place-items-center rounded-lg bg-primary-50 text-[9px] font-extrabold text-primary-700">{getInitials(profile.name)}</span>
              <span className="max-w-28 truncate text-[11px] font-bold text-navy-700">{profile.name}</span>
            </Link>
          </div>
        </header>

        <main id="main-content" className={cn("mx-auto w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8", maxWidth === "narrow" ? "max-w-5xl" : "max-w-[1600px]", !flush && "pb-28 lg:pb-10")}>
          {children}
        </main>
      </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-white/10 bg-navy-900/95 p-1.5 text-white shadow-panel backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
        {config.mobile.map((item) => {
          const active = isNavigationActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={cn("flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[9px] font-bold transition", active ? "bg-white text-navy-900" : "text-white/50 hover:bg-white/10 hover:text-white")} aria-current={active ? "page" : undefined}>
              <item.icon className={cn("size-4", active ? "text-primary-600" : "text-white/45")} />{item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
