import Link from "next/link";
import { ArrowLeft, Compass, MapPinned } from "lucide-react";
import { Brand } from "@/components/ui/Brand";

export default function NotFound() {
  return (
    <main className="civic-grid relative grid min-h-screen place-items-center overflow-hidden bg-ivory px-5 text-center">
      <div className="absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-saffron/10 blur-3xl" />
      <div className="relative max-w-xl">
        <div className="mx-auto w-fit"><Brand /></div>
        <div className="mx-auto mt-10 grid size-16 place-items-center rounded-3xl bg-navy text-saffron shadow-lift"><MapPinned className="size-7" /></div>
        <p className="mt-7 font-mono text-xs font-bold tracking-[0.2em] text-teal">404 · TRACE NOT FOUND</p>
        <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-navy">This path isn’t on the map.</h1>
        <p className="mt-4 text-sm leading-6 text-navy/50">The page may have moved, but your Outcome Passport and public evidence are still safe.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-navy px-5 text-sm font-bold text-white transition hover:bg-forest"><ArrowLeft className="size-4" /> Return home</Link>
          <Link href="/login" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-navy/12 bg-white px-5 text-sm font-bold text-navy transition hover:border-teal/30"><Compass className="size-4" /> Open demo</Link>
        </div>
      </div>
    </main>
  );
}
