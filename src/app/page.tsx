"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SportsReel } from "@/components/PixelScenes";
import { DEMO_SESSION } from "@/lib/demo-session";
import { saveSession } from "@/lib/types";



/**
 * The opening argument.
 *
 * A live stat sheet sits in the first viewport rather than a screenshot or a
 * feature grid: the product's whole claim is that the same player ranks
 * differently under different league rules, so the page shows that happening
 * to a name everyone knows before it asks for anything.
 */
export default function Landing() {
  const router = useRouter();

  function loadDemo() {
    saveSession(DEMO_SESSION);
    router.push("/app");
  }

  return (
    <main className="turf min-h-dvh">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <header className="on-field flex items-center justify-between gap-4">
          <span className="font-display text-2xl text-chalk">
            COURT<span className="text-gold">IQ</span>
          </span>
          <button
            onClick={loadDemo}
            className="border-[3px] border-ink bg-bone px-4 py-2 font-display text-sm text-ink transition hover:bg-gold"
          >
            See a sample league
          </button>
        </header>

        <div className="mt-12 grid items-start gap-8 lg:mt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div className="on-field">
            <h1 className="font-display text-[clamp(2.8rem,8vw,5.5rem)] leading-[0.88] text-chalk">
              YOUR LEAGUE
              <br />
              DOESN&apos;T PLAY BY
              <br />
              <span className="text-gold">GENERIC RULES.</span>
            </h1>

            <p className="mt-7 max-w-[36ch] text-lg leading-relaxed text-bone">
              CourtIQ reads your Sleeper league, its scoring format, playoff week, trade
              deadline and waiver rules, then ranks every pickup, sleeper and trade against
              them. And tells you why.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/setup"
                className="group inline-flex items-center gap-2.5 border-[3px] border-ink bg-flag px-7 py-4 font-display text-lg text-ink transition hover:bg-gold"
              >
                Import your league
                <Icon
                  name="arrow-right"
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </Link>
              <span className="text-sm text-bone-2">No login. No API key. Ten seconds.</span>
            </div>
          </div>

          <div>
            <StatSheet />
            {/* Three sports in one panel: fills the column's tail with the
                product's own subject, and states the sport-agnostic claim
                visually before the roadmap has to. */}
            <SportsReel className="mt-6" />
          </div>
        </div>

        <Ledger />

        <p className="mt-10 pb-4 text-center text-xs text-bone-2">
          Built for the Sports track · Data from the public Sleeper API
        </p>
      </div>
    </main>
  );
}

/**
 * A real ranked row and the reason behind it.
 *
 * These numbers are this engine's actual output for the 2025 season, which is
 * why the page can afford to lead with them instead of a claim.
 */
function StatSheet() {
  return (
    <div className="card deal">
      <div className="strip flex items-baseline justify-between px-5 py-3">
        <span className="font-display text-sm">SAME PLAYER · TWO RULEBOOKS</span>
        <span className="nums text-xs text-bone-3">2025</span>
      </div>

      <div className="border-b-[3px] border-ink bg-bone-2 px-5 py-5">
        <p className="font-display text-2xl leading-none">GIANNIS ANTETOKOUNMPO</p>
        <p className="nums mt-2 text-sm text-ink-2">PF · MIL · 30.4 PTS · 11.9 REB · 6.5 AST</p>
      </div>

      <dl className="grid grid-cols-2 divide-x-[3px] divide-ink border-b-[3px] border-ink">
        <div className="px-5 py-5">
          <dt className="text-xs text-ink-2">Category league</dt>
          <dd className="nums font-display text-5xl leading-none">69th</dd>
        </div>
        <div className="bg-gold px-5 py-5">
          <dt className="text-xs text-ink">Points league</dt>
          <dd className="nums font-display text-5xl leading-none">5th</dd>
        </div>
      </dl>

      <p className="px-5 py-4 text-sm leading-relaxed text-ink-2">
        Same season, same stat line. His free throws carry a{" "}
        <span className="font-display text-ink">−5.6</span> z-score at high volume, so category
        leagues punish exactly what points leagues pay for. CourtIQ knows which one you are in.
      </p>
    </div>
  );
}

/** Three claims, each carrying the specific thing that backs it. */
function Ledger() {
  const rows = [
    {
      k: "Reads your rules",
      v: "Scoring format, playoff week, trade deadline and waiver type, pulled from Sleeper and confirmed by you.",
    },
    {
      k: "Explains every call",
      v: "Rankings are deterministic. Each card carries the z-score or point total that produced it.",
    },
    {
      k: "Trades on your terms",
      v: "Ask for rebounds, name a player, or protect who you keep. The engine picks; the analyst pitches.",
    },
  ];

  return (
    <dl className="card mt-12 divide-y-[3px] divide-ink">
      {rows.map((r) => (
        <div key={r.k} className="gap-2 px-5 py-4 sm:flex sm:items-baseline sm:gap-8 sm:px-6">
          <dt className="shrink-0 font-display text-base sm:w-56">{r.k}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-ink-2 sm:mt-0">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
