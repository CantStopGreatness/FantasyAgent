"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveSession } from "@/lib/types";

const DEMO_SESSION = {
  leagueId: "demo",
  userId: "demo-user",
  confirmedFormat: "category" as const,
  ruleOverrides: {},
  scoringOverrides: {},
  league: {
    leagueId: "demo",
    name: "CourtIQ Demo League",
    season: "2024",
    sport: "nba",
    sportLabel: "NBA",
    statsSeason: "2024",
    currentWeek: 18,
    teamCount: 12,
    format: "category" as const,
    formatInferred: false,
    supportsCategories: true,
    rosterSize: 13,
    userTeamId: 1,
    rosteredCount: 156,
    scoredCount: 148,
  },
  settings: [
    { key: "playoff_week_start", label: "Playoffs start", value: "Week 22", raw: 22, kind: "week" as const },
    { key: "trade_deadline", label: "Trade deadline", value: "Week 18", raw: 18, kind: "week" as const },
    { key: "waiver_type", label: "Waiver type", value: "FAAB", raw: 2, kind: "enum" as const },
  ],
  scoring: [
    { key: "pts", label: "Points", value: 1 },
    { key: "reb", label: "Rebounds", value: 1 },
    { key: "ast", label: "Assists", value: 1 },
    { key: "stl", label: "Steals", value: 2 },
    { key: "blk", label: "Blocks", value: 2 },
    { key: "tov", label: "Turnovers", value: -1 },
    { key: "fg_pct", label: "FG%", value: 1 },
    { key: "ft_pct", label: "FT%", value: 1 },
  ],
  teams: [
    { rosterId: 1, teamName: "Your Team", ownerName: "You", playerCount: 13, isUserTeam: true },
    { rosterId: 2, teamName: "Hoop Dreams", ownerName: "Alex", playerCount: 13, isUserTeam: false },
    { rosterId: 3, teamName: "Ball Hogs", ownerName: "Jordan", playerCount: 13, isUserTeam: false },
  ],
};

export default function Landing() {
  const router = useRouter();

  function loadDemo() {
    saveSession(DEMO_SESSION);
    router.push("/app");
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
            Live Sleeper league data
          </p>

          <h1 className="font-display text-[clamp(2.75rem,9vw,6.5rem)] font-bold uppercase leading-[0.92] tracking-tight">
            Your league doesn&apos;t play
            <br />
            <span className="text-orange">by generic rules.</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted">
            Most fantasy advice ignores how your league actually scores. CourtIQ reads your
            Sleeper league, scoring format, playoff dates, trade deadline, and waiver rules,
            then ranks every pickup and trade against them. And it tells you exactly why.
          </p>

          {/* Sample analyst callout */}
          <div className="mt-10 max-w-xl rounded-xl border border-edge bg-panel px-6 py-5">
            <p className="mb-3 text-xs uppercase tracking-[0.15em] text-muted">
              Sample insight
            </p>
            <p className="text-base leading-relaxed text-ink">
              <span className="font-semibold text-orange">Anthony Davis</span> is your
              highest-value pickup this week. Your league rewards blocks heavily and your two
              weakest categories right now are points and rebounds. He covers both, and he
              has four home games this week.
            </p>
            <p className="mt-4 text-xs text-muted">
              CourtIQ reads this from your actual league rules, not a generic ranking.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link
              href="/setup"
              className="group inline-flex items-center gap-3 rounded-lg bg-orange px-7 py-4 font-display text-lg font-semibold uppercase tracking-wide text-[#1a0d06] transition hover:brightness-110"
            >
              Import your league
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            <button
              onClick={loadDemo}
              className="inline-flex items-center gap-2 rounded-lg border border-edge bg-panel px-7 py-4 font-display text-lg font-semibold uppercase tracking-wide text-ink transition hover:border-teal/60"
            >
              Try a demo
            </button>
          </div>
          <span className="mt-3 text-sm text-muted">
            No login. No API key. Takes ten seconds.
          </span>
        </div>

        <footer className="grid gap-px overflow-hidden rounded-xl border border-edge bg-edge sm:grid-cols-3">
          {[
            {
              title: "Scored for your league",
              body: "CourtIQ reads your league's actual scoring rules from Sleeper and ranks every player against them, not a generic template.",
            },
            {
              title: "Trade recommendations that make sense",
              body: "Trades are found by looking at what your roster actually needs, so the reasoning is always explainable.",
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