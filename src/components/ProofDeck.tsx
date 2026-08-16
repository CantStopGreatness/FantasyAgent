"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * The opening argument, dealt as a deck.
 *
 * Every number here is this engine's own output for the 2025 season, produced
 * by `scripts/verify-engine.ts`'s scoring path — the ranks, the z-scores and
 * the per-game lines all come from the same code the app runs. That is the
 * whole reason the landing page can lead with them instead of a claim, so if
 * the scoring changes, these change with it.
 *
 * Three slides rather than one because a single example reads as a cherry
 * pick. Giannis is the famous case, Murphy is the same effect running the
 * other way, and Castle is the widest gap of the three — together they show a
 * mechanism rather than an anecdote.
 */
type Slide = {
  name: string;
  meta: string;
  line: string;
  catRank: number;
  ptsRank: number;
  /** Which side of the split gets the gold panel: the rank that surprises. */
  favours: "category" | "points";
  why: React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    name: "GIANNIS ANTETOKOUNMPO",
    meta: "PF · 36 GP · 28.9 MPG",
    line: "27.6 PTS · 9.8 REB · 5.4 AST",
    catRank: 69,
    ptsRank: 5,
    favours: "points",
    why: (
      <>
        He shoots <span className="font-display text-ink">9.9 free throws a game at 65%</span>{" "}
        against a 78.8% pool baseline — a <span className="font-display text-ink">−5.6</span>{" "}
        z-score. Points leagues pay him for the makes. Category leagues charge him for the
        misses.
      </>
    ),
  },
  {
    name: "TREY MURPHY III",
    meta: "SF · 66 GP · 35.5 MPG",
    line: "21.5 PTS · 3.2 3PM · 1.5 STL",
    catRank: 12,
    ptsRank: 42,
    favours: "category",
    why: (
      <>
        The same effect, running backwards. Threes at{" "}
        <span className="font-display text-ink">+2.2</span> and steals at{" "}
        <span className="font-display text-ink">+1.8</span> win him two whole categories every
        week. A points league counts a three as three points and a steal as almost nothing.
      </>
    ),
  },
  {
    name: "STEPHON CASTLE",
    meta: "PG · 68 GP · 30.0 MPG",
    line: "16.7 PTS · 7.4 AST · 3.2 TO",
    catRank: 157,
    ptsRank: 50,
    favours: "points",
    why: (
      <>
        A <span className="font-display text-ink">107-place</span> split, driven by the category
        most points leagues never count. His 3.2 turnovers a game score{" "}
        <span className="font-display text-ink">−2.3</span>, and nothing in his line pays it
        back.
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
      aria-label="How league rules change a player's rank"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <div className="strip flex items-center gap-3 px-4 py-2">
        <span className="font-display text-sm">SAME PLAYER · TWO RULEBOOKS</span>

        <div className="ml-auto flex items-center gap-1.5">
          <DeckButton label="Previous player" onClick={() => step(-1)}>
            <Icon name="arrow-left" className="h-3.5 w-3.5" />
          </DeckButton>

          {/* Square tallies, not dots — this world is ruled, not rounded. */}
          <div className="flex items-center gap-1 px-0.5">
            {SLIDES.map((s, i) => (
              <button
                key={s.name}
                onClick={() => {
                  setPlaying(false);
                  go(i);
                }}
                aria-label={`Show ${s.name.toLowerCase()}`}
                aria-current={i === active ? "true" : undefined}
                className={`h-2.5 w-2.5 border-2 transition ${
                  i === active
                    ? "border-gold bg-gold"
                    : "border-bone-3 bg-transparent hover:bg-bone-3"
                }`}
              />
            ))}
          </div>

          <DeckButton label="Next player" onClick={() => step(1)}>
            <Icon name="arrow-right" className="h-3.5 w-3.5" />
          </DeckButton>

          {/* An auto-advancing deck owes the reader a way to stop it that does
              not depend on holding a pointer still. */}
          <DeckButton
            label={playing ? "Pause the deck" : "Play the deck"}
            onClick={() => setPlaying((p) => !p)}
          >
            <Icon name={playing ? "pause" : "play"} className="h-3.5 w-3.5" />
          </DeckButton>
        </div>
      </div>

      {/* Slides are stacked in one grid cell so the panel takes the height of
          the tallest and never jolts the page as it cycles. */}
      <div className="grid" aria-live={playing && !held ? "off" : "polite"}>
        {SLIDES.map((s, i) => (
          <div
            key={s.name}
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
    </div>
  );
}

function DeckButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-6 w-6 place-items-center border-2 border-bone-3 text-bone transition hover:border-gold hover:text-gold"
    >
      {children}
    </button>
  );
}

function SlideBody({ slide }: { slide: Slide }) {
  const goldIsPoints = slide.favours === "points";

  return (
    <>
      <div className="border-b-[3px] border-ink bg-bone-2 px-5 py-5">
        <p className="font-display text-2xl leading-none">{slide.name}</p>
        <p className="nums mt-2 text-sm text-ink-2">{slide.meta}</p>
        <p className="nums mt-1 text-sm text-ink-2">{slide.line}</p>
      </div>

      <dl className="grid grid-cols-2 divide-x-[3px] divide-ink border-b-[3px] border-ink">
        <div className={`px-5 py-5 ${goldIsPoints ? "" : "bg-gold"}`}>
          <dt className="text-xs text-ink-2">Category league</dt>
          <dd className="nums font-display text-5xl leading-none">{ordinal(slide.catRank)}</dd>
        </div>
        <div className={`px-5 py-5 ${goldIsPoints ? "bg-gold" : ""}`}>
          <dt className="text-xs text-ink-2">Points league</dt>
          <dd className="nums font-display text-5xl leading-none">{ordinal(slide.ptsRank)}</dd>
        </div>
      </dl>

      <p className="px-5 py-4 text-sm leading-relaxed text-ink-2">{slide.why}</p>
    </>
  );
}

function ordinal(n: number) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
