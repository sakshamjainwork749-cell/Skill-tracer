"use client";

import Link from "next/link";
import { ArrowRight, Eye, LockKeyhole, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/types";
import { Card } from "@/components/ui/Card";

export function DemoAccessNotice({ role }: { role: UserRole }) {
  const { user, isHydrated } = useAuth();
  if (!isHydrated || user) return null;
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-saffron/25 bg-saffron-soft/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Eye className="mt-0.5 size-4 shrink-0 text-[#95560C]" />
        <div>
          <p className="text-xs font-bold text-navy">You’re viewing a populated demo</p>
          <p className="mt-0.5 text-[11px] leading-4 text-navy/55">
            No sign-in needed to explore. Local updates work as real interactions.
          </p>
        </div>
      </div>
      <Link
        href={`/login?role=${role}`}
        className="inline-flex items-center gap-1 text-xs font-bold text-teal hover:underline"
      >
        Sign in to this workspace <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

export function RoleGuard({ role }: { role: UserRole }) {
  const { user, isHydrated } = useAuth();
  console.debug("[GUARD] expected role:", role);
  console.debug("[GUARD] actual role:", isHydrated ? (user?.role ?? "none") : "hydrating");
  if (!isHydrated) {
    // Fixed overlay: a loading gate must never occupy in-flow space above the
    // dashboard (it would push the navbar/content down the page).
    return (
      <div className="fixed inset-0 z-[75] grid place-items-center bg-ivory/95 p-5 backdrop-blur-md" role="status" aria-label="Checking access">
        <Card className="grid w-full max-w-sm place-items-center p-10">
          <div className="size-10 animate-spin rounded-full border-2 border-navy/10 border-t-teal" />
          <p className="mt-4 text-xs font-bold text-navy/50">Checking access…</p>
        </Card>
      </div>
    );
  }
  if (user && user.role === role) return null;

  const roleName = role === "admin" ? "government" : role;
  const signedInRole = user ? (user.role === "admin" ? "government" : user.role) : null;
  return (
    <div className="fixed inset-0 z-[75] grid place-items-center overflow-y-auto bg-ivory/95 p-5 backdrop-blur-md">
      <Card className="my-8 grid min-h-[520px] w-full max-w-2xl place-items-center p-6 text-center shadow-lift">
        <div className="max-w-md">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-red-50 text-coral">
          <ShieldAlert className="size-7" />
        </div>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-coral">
          {signedInRole ? "Role protected" : "Sign-in required"}
        </p>
        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-navy">
          {signedInRole ? "This isn't your workspace" : "This workspace needs sign-in"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-navy/55">
          {signedInRole
            ? `You're signed in as ${signedInRole}. This ${roleName} workspace requires its own authenticated role.`
            : `Sign in to the ${roleName} workspace to continue. Unauthenticated access is blocked even with a direct link.`}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={`/login?role=${role}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal px-4 text-sm font-semibold text-white transition hover:bg-[#086a66] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/20"
          >
            {signedInRole ? `Sign in as ${roleName}` : `Sign in to continue`} <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-navy/15 bg-white/70 px-4 text-sm font-semibold text-navy transition hover:border-teal/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/10"
          >
            Back to home
          </Link>
        </div>
        <p className="mt-5 inline-flex items-center gap-1.5 text-[11px] text-navy/40">
          <LockKeyhole className="size-3" /> Protected by SkillTrace role checks
        </p>
        </div>
      </Card>
    </div>
  );
}
