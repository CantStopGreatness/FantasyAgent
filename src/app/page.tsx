"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { SportsReel } from "@/components/PixelScenes";
import { ProofDeck } from "@/components/ProofDeck";
import { loadDemoSession } from "@/lib/demo-session";
import { saveSession } from "@/lib/types";

/**
 * The opening argument.
 *
 * A stat sheet sits in the first viewport rather than a screenshot or a
 * feature grid: CourtIQ's central claim is that league rules change the answer.
 */
export default function Landing() {
  const router = useRouter();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function loadDemo() {
    if (demoBusy) return;
    setDemoBusy(true);
    setDemoError(null);
    try {
      saveSession(await loadDemoSession());
      router.push("/app");
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Could not load the demo.");
      setDemoBusy(false);
    }
  }

  return (
    <main className="turf min-h-dvh">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <header className="on-field flex items-center justify-between gap-4">
          <span className="font-display text-2xl text-chalk">
            COURT<span className="text-gold">IQ</span>
          </span>
          <button
            type="button"
            onClick={loadDemo}
            disabled={demoBusy}
            className="border-[3px] border-ink bg-bone px-4 py-2 font-display text-sm text-ink transition hover:bg-gold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {demoBusy ? "Loading sample..." : "See a sample league"}
          </button>
        </header>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:mt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
          <div className="on-field">
            <h1 className="font-display text-[clamp(2.8rem,8vw,5.5rem)] leading-[0.88] text-chalk">
              <TypeLine text="YOUR" start={0.1} />
              <TypeLine text="LEAGUE" start={0.32} />
              <TypeLine text="DOESN'T" start={0.63} />
              <TypeLine text="PLAY BY" start={0.98} />
              <TypeLine text="GENERIC" start={1.33} className="text-gold" />
              <TypeLine text="RULES." start={1.68} className="text-gold" caret />
            </h1>

            <p
              className="after-type mt-7 max-w-[39ch] text-lg leading-relaxed text-bone"
              style={{ animationDelay: "2.08s" }}
            >
              CourtIQ imports your Sleeper NBA league, applies its supported scoring values,
              filters out rostered players, and calculates waiver, sleeper, and one-for-one
              trade recommendations with a deterministic engine.
            </p>

            <div
              className="after-type mt-9 flex flex-wrap items-center gap-3"
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
              <button
                type="button"
                onClick={loadDemo}
                disabled={demoBusy}
                className="border-[3px] border-bone-3 px-7 py-4 font-display text-lg text-bone transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {demoBusy ? "Loading demo..." : "Try demo"}
              </button>
            </div>

            {demoError && (
              <p role="alert" className="after-type mt-3 max-w-md text-sm text-bone">
                {demoError}
              </p>
            )}
            <p className="after-type mt-3 text-sm text-bone-2">
              No Sleeper login required. Ollama narration is optional and never decides a rank
              or trade.
            </p>
          </div>

          <div>
            <ProofDeck />
            <SportsReel className="mt-6" />
          </div>
        </div>

        <Ledger />

        <p className="mt-10 pb-4 text-center text-xs text-bone-2">
          Sleeper NBA leagues · Data from the public Sleeper API
        </p>
      </div>
    </main>
  );
}

/**
 * One visual line of the headline, revealed without mounting characters one
 * at a time so it stays readable, copyable, and stable.
 */
function TypeLine({
  text,
  start,
  className = "",
  caret = false,
}: {
  text: string;
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

/** Three product claims paired with the implementation that supports them. */
function Ledger() {
  const rows = [
    {
      k: "Uses your supported scoring",
      v: "Imported point values with exact NBA player rates affect the calculation. Excluded values stay visible and do not pretend to work.",
    },
    {
      k: "Shows the deterministic result",
      v: "Waiver and sleeper boards remove rostered players and show the computed point total or category score behind each recommendation.",
    },
    {
      k: "Trades on your terms",
      v: "Set category goals, target an opponent's player, or protect your roster. The engine builds the candidate; optional narration only explains it.",
    },
  ];

  return (
    <dl className="card mt-12 divide-y-[3px] divide-ink">
      {rows.map((row) => (
        <div
          key={row.k}
          className="gap-2 px-5 py-4 sm:flex sm:items-baseline sm:gap-8 sm:px-6"
        >
          <dt className="shrink-0 font-display text-base sm:w-56">{row.k}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-ink-2 sm:mt-0">{row.v}</dd>
        </div>
      ))}
    </dl>
  );
}
