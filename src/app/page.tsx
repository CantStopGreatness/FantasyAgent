import Link from "next/link";

/**
 * Marketing entry point — one screen, no scroll-heavy copy.
 * Its whole job is to establish the brand and push into /setup.
 */
export default function Landing() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Court geometry: a faint half-court arc and key, set behind everything. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-[18rem] -top-[16rem] h-[46rem] w-[46rem] rounded-full border border-edge/60" />
        <div className="absolute -right-[10rem] -top-[8rem] h-[30rem] w-[30rem] rounded-full border border-edge/40" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(80rem 40rem at 78% -10%, rgba(255,107,53,0.10), transparent 60%), radial-gradient(60rem 40rem at 8% 110%, rgba(0,194,209,0.08), transparent 60%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-6 sm:px-10">
        <header className="flex items-center justify-between py-8">
          <span className="font-display text-2xl font-bold tracking-wide">
            COURT<span className="text-orange">IQ</span>
          </span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-muted sm:block">
            Fantasy League Intelligence
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12">
          <p className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs uppercase tracking-[0.15em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            Live Sleeper league data
          </p>

          <h1 className="font-display text-[clamp(2.75rem,9vw,6.5rem)] font-bold uppercase leading-[0.92] tracking-tight">
            Your league doesn&apos;t play
            <br />
            <span className="text-orange">by generic rules.</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
            Most fantasy advice ignores how your league actually scores. CourtIQ reads your
            Sleeper league — scoring format, playoff dates, trade deadline, waiver rules — and
            ranks every pickup, sleeper, and trade against them. Then it tells you why, out loud.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-5">
            <Link
              href="/setup"
              className="group inline-flex items-center gap-3 rounded-lg bg-orange px-7 py-4 font-display text-lg font-semibold uppercase tracking-wide text-[#1a0d06] transition hover:brightness-110"
            >
              Import your league
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            <span className="text-sm text-muted">No login. No API key. Takes ten seconds.</span>
          </div>
        </div>

        <footer className="grid gap-px overflow-hidden rounded-xl border border-edge bg-edge sm:grid-cols-3">
          {[
            {
              title: "Format-aware scoring",
              body: "Category z-scores or your league's own per-stat point values — read from the league, never guessed at.",
            },
            {
              title: "Rule-based trades",
              body: "Positional imbalances found deterministically, so the logic is explainable.",
            },
            {
              title: "An analyst with opinions",
              body: "Every call comes with a read on why it matters right now, not a stat table.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-panel px-6 py-7">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </footer>

        <p className="py-8 text-center text-xs text-muted">
          Built for the Sports track · Data from the public Sleeper API
        </p>
      </div>
    </main>
  );
}
