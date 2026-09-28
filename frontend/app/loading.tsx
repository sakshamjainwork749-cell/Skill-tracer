import { Brand } from "@/components/ui/Brand";

export default function Loading() {
  return (
    <div className="min-h-screen bg-ivory">
      <header className="flex h-[72px] items-center border-b border-navy/8 bg-paper/70 px-5 sm:px-8">
        <Brand />
      </header>
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="animate-pulse">
          <div className="h-4 w-36 rounded-full bg-navy/8" />
          <div className="mt-5 h-10 w-full max-w-xl rounded-2xl bg-navy/8" />
          <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-navy/6" />
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-36 rounded-3xl border border-navy/5 bg-paper" />
            ))}
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="h-96 rounded-3xl border border-navy/5 bg-paper lg:col-span-2" />
            <div className="h-96 rounded-3xl border border-navy/5 bg-paper" />
          </div>
        </div>
        <p className="sr-only" role="status">Loading SkillTrace</p>
      </main>
    </div>
  );
}
