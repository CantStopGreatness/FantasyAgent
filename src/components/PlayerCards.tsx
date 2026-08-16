"use client";

import { Icon } from "./Icon";
import type { PlayerCard, ScoringFormat, TagTone } from "@/lib/types";

/** Flat stamped chips — ink rule, no radius, colour carries the meaning. */
const TONE: Record<TagTone, string> = {
  hot: "border-flag bg-flag text-ink",
  good: "border-ink bg-bone-2 text-ink",
  warn: "border-whistle bg-whistle text-bone",
};

function Tag({ label, tone }: { label: string; tone: TagTone }) {
  return (
    <span className={`border-2 px-2 py-0.5 text-[0.7rem] leading-tight ${TONE[tone]}`}>
      {label}
    </span>
  );
}

const OTHER_FORMAT: Record<ScoringFormat, string> = {
  category: "points",
  points: "cats",
};

/**
 * Cross-format rank movement.
 *
 * The one piece of metadata worth its pixels: it makes the league's scoring
 * rules legible on a player the reader has never heard of, instead of asking
 * them to take the ranking on faith.
 */
function RankShift({ card, format }: { card: PlayerCard; format: ScoringFormat }) {
  if (card.rankDelta === null || Math.abs(card.rankDelta) < 8) return null;
  const better = card.rankDelta > 0;
  return (
    <span
      className={`nums inline-flex items-center gap-1 border-2 border-ink px-1.5 py-0.5 text-[0.7rem] leading-tight ${
        better ? "bg-gain text-bone" : "bg-bone-3 text-ink"
      }`}
      title={`Ranks ${card.otherFormatRank} in ${OTHER_FORMAT[format]} scoring`}
    >
      <Icon name={better ? "up" : "down"} className="h-2.5 w-2.5" />
      {Math.abs(card.rankDelta)} vs {OTHER_FORMAT[format]}
    </span>
  );
}

/** The single featured pickup — the sheet's headline entry. */
export function HeroCard({
  card,
  format,
  label,
}: {
  card: PlayerCard;
  format: ScoringFormat;
  label: string;
}) {
  return (
    <article className="card deal">
      <div className="strip flex items-center justify-between px-5 py-2.5">
        <span className="font-display text-sm">{label}</span>
        <span className="nums text-xs text-bone-3">
          {format === "category" ? "TOTAL Z" : "PTS / GAME"}
        </span>
      </div>

      {/* Stacks on narrow screens: the score plane cannot shrink, so side by
          side it would push the whole page wider than the viewport. */}
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1 px-5 py-5 sm:px-6">
          <h3 className="font-display text-2xl leading-none sm:text-4xl">{card.name}</h3>
          <p className="mt-2 text-sm text-ink-2">
            {card.position} · {card.team}
            {card.injuryStatus && (
              <span className="ml-2 text-whistle">{card.injuryStatus}</span>
            )}
          </p>
          <p className="nums mt-4 text-sm text-ink-2">{card.statLine}</p>

          {(card.tags.length > 0 || card.rankDelta !== null) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {card.tags.map((t) => (
                <Tag key={t.label} {...t} />
              ))}
              <RankShift card={card} format={format} />
            </div>
          )}
        </div>

        {/* The number, given its own plane. */}
        <div className="grid shrink-0 place-items-center border-t-[3px] border-ink bg-gold px-5 py-4 sm:border-l-[3px] sm:border-t-0 sm:px-7 sm:py-0">
          <span className="nums font-display text-3xl leading-none sm:text-5xl">
            {card.scoreLabel}
          </span>
        </div>
      </div>
    </article>
  );
}

/** One line of the stat sheet. */
export function PlayerRow({ card, format }: { card: PlayerCard; format: ScoringFormat }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 odd:bg-bone even:bg-bone-2 sm:gap-4 sm:px-5">
      <span className="nums w-7 shrink-0 font-display text-lg text-ink-2">{card.rank}</span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="font-display text-base leading-tight">{card.name}</span>
          <span className="text-xs text-ink-2">
            {card.position} · {card.team}
          </span>
          {card.injuryStatus && (
            <span className="text-xs text-whistle">{card.injuryStatus}</span>
          )}
        </div>
        <p className="nums mt-0.5 truncate text-xs text-ink-2">
          {card.reason ?? card.statLine}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {card.tags.slice(0, 1).map((t) => (
          <Tag key={t.label} {...t} />
        ))}
        <RankShift card={card} format={format} />
      </div>

      <span className="nums w-20 shrink-0 text-right font-display text-base leading-tight sm:text-lg">
        {card.scoreLabel}
      </span>
    </li>
  );
}

export function PlayerList({ cards, format }: { cards: PlayerCard[]; format: ScoringFormat }) {
  return (
    <ul className="card">
      {cards.map((c) => (
        <PlayerRow key={c.playerId} card={c} format={format} />
      ))}
    </ul>
  );
}
