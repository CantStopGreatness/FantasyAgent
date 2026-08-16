"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveSession, type Snapshot } from "@/lib/types";
import { useState } from "react";

export default function Landing() {
  const router = useRouter();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function loadDemo() {
    if (demoBusy) return;
    setDemoBusy(true);
    setDemoError(null);
    try {
      const response = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leagueId: "demo", userId: "demo-user" }),
      });
      const snapshot = (await response.json()) as Snapshot & { error?: string };
      if (!response.ok) throw new Error(snapshot.error ?? "Could not load the demo.");

      saveSession({
        leagueId: snapshot.league.leagueId,
        userId: "demo-user",
        league: snapshot.league,
        settings: snapshot.settings,
        scoring: snapshot.scoring,
        teams: snapshot.teams,
        confirmedFormat: snapshot.league.format,
        ruleOverrides: {},
        scoringOverrides: {},
      });
      router.push("/app");
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Could not load the demo.");
      setDemoBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Court geometry */}
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
            Public Sleeper league data
          </p>

          <h1 className="font-display text-[clamp(2.75rem,9vw,6.5rem)] font-bold uppercase leading-[0.92] tracking-tight">
            Your league doesn&apos;t play
            <br />
            <span className="text-orange">by generic rules.</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
            Most fantasy advice ignores how your league actually scores. CourtIQ imports your
            Sleeper NBA league, filters out players already rostered, and ranks available players
            with your supported scoring values. It also shows the deterministic logic behind a
            one-for-one trade candidate.
          </p>

          {/* Sample analyst callout */}
          <div className="mt-10 max-w-xl rounded-xl border border-edge bg-panel px-6 py-5">
            <p className="mb-3 text-xs uppercase tracking-[0.15em] text-muted">
              Sample insight
            </p>
            <p className="text-base leading-relaxed text-ink">
              <span className="font-semibold text-orange">A category specialist</span> can rank
              very differently from a high-volume scorer when the league format changes. CourtIQ
              makes that scoring difference visible.
            </p>
            <p className="mt-4 text-xs text-muted">
              CourtIQ uses the imported scoring setup, not a generic ranking.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link
              href="/setup"
              className="group inline-flex items-center gap-3 rounded-lg bg-orange px-7 py-4 font-display text-lg font-semibold uppercase tracking-wide text-[#1a0d06] transition hover:brightness-110"
            >
              Import your league
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                -&gt;
              </span>
            </Link>
            <button
              onClick={loadDemo}
              disabled={demoBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-edge bg-panel px-7 py-4 font-display text-lg font-semibold uppercase tracking-wide text-ink transition hover:border-teal/60"
            >
              {demoBusy ? "Loading demo..." : "Try a demo"}
            </button>
          </div>
          {demoError && (
            <p role="alert" className="mt-3 text-sm text-red">
              {demoError}
            </p>
          )}
          <span className="mt-3 text-sm text-muted">
            No Sleeper login required. Ollama Cloud narration is optional.
          </span>
        </div>

        <footer className="grid gap-px overflow-hidden rounded-xl border border-edge bg-edge sm:grid-cols-3">
          {[
            {
              title: "Scored for your league",
              body: "CourtIQ ranks active, fantasy-relevant NBA players using supported point values or its category model - not a generic template.",
            },
            {
              title: "Trade recommendations that make sense",
              body: "Trades are deterministic one-for-one candidates based on positional group depth and comparable computed value.",
            },
            {
              title: "An analyst with opinions",
              body: "Every recommendation comes with a plain-English read on why it matters right now, not just a stat table.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-panel px-6 py-7">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </footer>

        <p className="py-8 text-center text-xs text-muted">
          Data from the public Sleeper API
        </p>
      </div>
    </main>
  );
}
