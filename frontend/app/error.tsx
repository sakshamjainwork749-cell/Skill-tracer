"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-ivory px-5 text-center">
      <div className="max-w-lg">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-red-50 text-coral"><ShieldAlert className="size-7" /></div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.17em] text-coral">Something interrupted the trace</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-navy">We couldn’t load this view.</h1>
        <p className="mt-3 text-sm leading-6 text-navy/50">Your saved draft and local demo data are safe. Try the view again, or return to the public entry point.</p>
        {error.digest && <p className="mt-3 font-mono text-[10px] text-navy/25">Reference {error.digest}</p>}
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset}><RefreshCw className="size-4" /> Try again</Button>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-navy/15 bg-white/70 px-4 text-sm font-semibold text-navy transition hover:border-teal/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal/10"
          >
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
