"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * The opening argument, dealt as a deck.
 *
 * Every number here is this engine's own output for the 2025 season, produced
 * by the same scoring, form and category code the app runs — ranks, z-scores,
 * per-36 production and late-season minutes all come from `src/lib/engine`.
 * That is the whole reason the landing page can lead with them instead of a
 * claim, so if the scoring changes, these change with it.
 *
 * Deliberately nothing here is live: no trending-adds counts, no ownership.
 * Those move daily and would rot on a static page. Season-derived figures do
 * not.
 *
 * One card grammar carries two kinds of slide — a cross-format rank split and
 * a board insight — because they are the same claim from different angles:
 * the rules decide the answer. Three swing cards alone read as a cherry pick;
 * the insights show the engine doing the rest of its job.
 */
type Slide = {
  /** Strip label — changes per slide, since the deck is no longer one topic. */
  kicker: string;
  headline: string;
  meta: string;
  detail?: string;
  panels: [Panel, Panel];
  /** Which panel gets the gold: the number that carries the surprise. */
  gold: 0 | 1;
  why: React.ReactNode;
};

type Panel = { label: string; value: string };

const SLIDES: Slide[] = [
  {
    kicker: "SAME PLAYER · TWO RULEBOOKS",
    headline: "GIANNIS ANTETOKOUNMPO",
    meta: "PF · 36 GP · 28.9 MPG",
    detail: "27.6 PTS · 9.8 REB · 5.4 AST",
    panels: [
      { label: "Category league", value: "69th" },
      { label: "Points league", value: "5th" },
    ],
    gold: 1,
    why: (
      <>
        He shoots <Em>9.9 free throws a game at 65%</Em> against a 78.8% pool baseline — a{" "}
        <Em>−5.6</Em> z-score. Category scoring charges that percentage drag; points scoring
        applies the configured event weights and lets his counting volume carry the result.
      </>
    ),
  },
  {
    kicker: "SAME PLAYER · TWO RULEBOOKS",
    headline: "TREY MURPHY III",
    meta: "SF · 66 GP · 35.5 MPG",
    detail: "21.5 PTS · 3.2 3PM · 1.5 STL",
    panels: [
      { label: "Category league", value: "12th" },
      { label: "Points league", value: "42nd" },
    ],
    gold: 0,
    why: (
      <>
        The same effect, running backwards. Threes at <Em>+2.2</Em> and steals at <Em>+1.8</Em>{" "}
        give him scarce production in two category columns. Points scoring converts those events
        to the league&apos;s imported weights and values them as part of his full line.
      </>
    ),
  },
  {
    kicker: "SAME PLAYER · TWO RULEBOOKS",
    headline: "STEPHON CASTLE",
    meta: "PG · 68 GP · 30.0 MPG",
    detail: "16.7 PTS · 7.4 AST · 3.2 TO",
    panels: [
      { label: "Category league", value: "157th" },
      { label: "Points league", value: "50th" },
    ],
    gold: 1,
    why: (
      <>
        A <Em>107-place</Em> split, driven by how the formats treat his full line. His 3.2
        turnovers a game score <Em>−2.3</Em> in categories; points scoring applies the imported
        turnover weight alongside his positive counting stats.
      </>
    ),
  },
  {
    kicker: "BIGGEST RISER ON THE BOARD",
    headline: "LEONARD MILLER",
    meta: "C · 22 years old · 46 GP",
    detail: "15.6 MPG on the season",
    panels: [
      { label: "Late-season minutes", value: "+103%" },
      { label: "Production per 36", value: "32.3" },
    ],
    gold: 0,
    why: (
      <>
        Points, rebounds, assists, steals, blocks and threes come to <Em>32.3 per 36 minutes</Em>{" "}
        — and over the closing weeks his minutes ran at double his own season rate. The sleeper
        board looks for a role changing, not a hot week.
      </>
    ),
  },
  {
    kicker: "NOT ALL NINE ARE EQUAL",
    headline: "BLOCKS",
    meta: "Scarcest category · pool of 370",
    detail: "2025 season",
    panels: [
      { label: "Players above average", value: "131" },
      { label: "Best player's z-score", value: "+6.5" },
    ],
    gold: 1,
    why: (
      <>
        Threes are the opposite: <Em>173</Em> players clear the average and the best is worth{" "}
        <Em>+3.6</Em>. That gap is why asking for blocks costs more in a trade than asking for
        threes — and why CourtIQ prices a deal against your league&apos;s categories instead of a
        generic value chart.
      </>
    ),
  },
];

const DWELL_MS = 7000;

export function ProofDeck() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Hover and keyboard focus hold the deck still: a card that advances while
  // it is being read is a card that cannot be read.
  const [held, setHeld] = useState(false);

  const go = useCallback((next: number) => {
    setActive(((next % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  // Someone who reaches for an arrow has taken over; stop advancing under them.
  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      go(active + delta);
    },
    [active, go],
  );

  useEffect(() => {
    if (!playing || held) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Keyed on `active`, so any manual move restarts the full dwell rather
    // than flipping again a moment later.
    const id = setTimeout(() => go(active + 1), DWELL_MS);
    return () => clearTimeout(id);
  }, [active, playing, held, go]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  }

  return (
    <div
      className="card deal"
      role="group"
      aria-roledescription="carousel"
      aria-label="How league rules change what a player is worth"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <div className="strip flex items-center gap-3 px-4 py-2">
        {/* The label belongs to the slide now that the deck carries more than
            one kind of card, so it turns with the content. */}
        <span className="min-w-0 truncate font-display text-sm">{SLIDES[active].kicker}</span>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Square tallies, not dots — this world is ruled, not rounded. */}
          <div className="flex items-center gap-1 px-0.5">
            {SLIDES.map((s, i) => (
              <button
                key={s.headline}
                onClick={() => {
                  setPlaying(false);
                  go(i);
                }}
                aria-label={`Show ${s.headline.toLowerCase()}`}
                aria-current={i === active ? "true" : undefined}
                className={`h-2.5 w-2.5 border-2 transition ${
                  i === active
                    ? "border-gold bg-gold"
                    : "border-bone-3 bg-transparent hover:bg-bone-3"
                }`}
              />
            ))}
          </div>

          {/* An auto-advancing deck owes the reader a way to stop it that does
              not depend on holding a pointer still. */}
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause the deck" : "Play the deck"}
            className="grid h-6 w-6 place-items-center border-2 border-bone-3 text-bone transition hover:border-gold hover:text-gold"
          >
            <Icon name={playing ? "pause" : "play"} className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Rails rather than arrows floated over the card: at this size an
          overlaid control would sit on top of the rank figures, and a panel
          ruled in 3px ink has somewhere better to put them. */}
      <div className="grid grid-cols-[32px_1fr_32px] divide-x-[3px] divide-ink border-t-[3px] border-ink">
        <Rail label="Previous card" onClick={() => step(-1)} icon="arrow-left" />

        {/* Slides stack in one grid cell so the panel takes the height of the
            tallest and never jolts the page as it cycles. */}
        <div className="grid min-w-0" aria-live={playing && !held ? "off" : "polite"}>
          {SLIDES.map((s, i) => (
            <div
              key={s.headline}
              className="proof-slide col-start-1 row-start-1"
              data-active={i === active}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
              aria-hidden={i === active ? undefined : true}
            >
              <SlideBody slide={s} />
            </div>
          ))}
        </div>

        <Rail label="Next card" onClick={() => step(1)} icon="arrow-right" />
      </div>
    </div>
  );
}

function Rail({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: "arrow-left" | "arrow-right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid place-items-center bg-ink text-bone transition hover:bg-gold hover:text-ink"
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function SlideBody({ slide }: { slide: Slide }) {
  return (
    <>
      <div className="border-b-[3px] border-ink bg-bone-2 px-4 py-4">
        <p className="font-display text-xl leading-tight">{slide.headline}</p>
        <p className="nums mt-1.5 text-sm text-ink-2">{slide.meta}</p>
        {slide.detail && <p className="nums mt-0.5 text-sm text-ink-2">{slide.detail}</p>}
      </div>

      <dl className="grid grid-cols-2 divide-x-[3px] divide-ink border-b-[3px] border-ink">
        {slide.panels.map((p, i) => (
          <div key={p.label} className={`px-4 py-4 ${slide.gold === i ? "bg-gold" : ""}`}>
            <dt className={`text-xs ${slide.gold === i ? "text-ink" : "text-ink-2"}`}>{p.label}</dt>
            <dd className="nums font-display text-[2.5rem] leading-none">{p.value}</dd>
          </div>
        ))}
      </dl>

      <p className="px-4 py-4 text-sm leading-relaxed text-ink-2">{slide.why}</p>
    </>
  );
}

/** A figure inside prose, weighted so the number reads before the sentence. */
function Em({ children }: { children: React.ReactNode }) {
  return <span className="font-display text-ink">{children}</span>;
}
