"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SportsReel } from "@/components/PixelScenes";
import { ProofDeck } from "@/components/ProofDeck";
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
              {/* One TypeLine per *visual* line. A line that wraps would be
                  clipped as one box, revealing both of its rows at once —
                  which is not typing. Seven characters is the widest that
                  still fits this column at the clamp's ceiling, so these never
                  wrap and the effect holds at every width. */}
              <TypeLine text="YOUR" start={0.1} />
              <TypeLine text="LEAGUE" start={0.32} />
              <TypeLine text="DOESN'T" start={0.63} />
              <TypeLine text="PLAY BY" start={0.98} />
              <TypeLine text="GENERIC" start={1.33} className="text-gold" />
              <TypeLine text="RULES." start={1.68} className="text-gold" caret />
            </h1>

            <p
              className="after-type mt-7 max-w-[36ch] text-lg leading-relaxed text-bone"
              style={{ animationDelay: "2.08s" }}
            >
              CourtIQ reads your Sleeper league, its scoring format, playoff week, trade
              deadline and waiver rules, then ranks every pickup, sleeper and trade against
              them. And tells you why.
            </p>

            <div
              className="after-type mt-9 flex flex-wrap items-center gap-4"
              style={{ animationDelay: "2.28s" }}
            >
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
            <ProofDeck />
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
 * One line of the headline, typed in.
 *
 * The full text is in the DOM from the first paint — the reveal is a clip, not
 * a per-character mount — so the line is readable to a screen reader, copyable,
 * selectable, and never reflows as it lands. Duration and step count come from
 * the line's own length so every line types at the same speed rather than the
 * same duration, and the caller stages the starts so one line finishes before
 * the next begins.
 */
function TypeLine({
  text,
  start,
  className = "",
  caret = false,
}: {
  text: string;
  /** Seconds from load. */
  start: number;
  className?: string;
  caret?: boolean;
}) {
  const steps = text.length + (caret ? 1 : 0);

  return (
    <span
      className={`type-line ${className}`}
      style={{
        animationDuration: `${steps * 45}ms`,
        animationTimingFunction: `steps(${steps})`,
        animationDelay: `${start}s`,
      }}
    >
      {text}
      {caret && <i className="caret" />}
    </span>
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
