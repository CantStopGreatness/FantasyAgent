"use client";

import type { PlayerCard, ScoringFormat, TagTone } from "@/lib/types";

const TONE: Record<TagTone, string> = {
  hot: "border-orange/40 bg-orange/10 text-orange",
  good: "border-teal/40 bg-teal/10 text-teal",
  warn: "border-red/40 bg-red/10 text-red",
};

function Tag({ label, tone }: { label: string; tone: TagTone }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium tracking-wide ${TONE[tone]}`}
    >
      {label}
    </span>
  );
}

const OTHER_FORMAT: Record<ScoringFormat, string> = {
  category: "Points",
  points: "9-CAT",
};

/**
 * Cross-format rank movement.
 *
 * This is the one piece of metadata worth the extra pixels: it makes the
 * toggle's effect legible on players a judge has never heard of, instead of
 * asking them to remember where a name sat two seconds ago.
 */
function RankShift({ card, format }: { card: PlayerCard; format: ScoringFormat }) {
  if (card.rankDelta === null || Math.abs(card.rankDelta) < 8) return null;
  const better = card.rankDelta > 0;
  return (
    <span
      className={`nums inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.7rem] font-medium ${
        better ? "bg-green/10 text-green" : "bg-red/10 text-red"
      }`}
      title={`Ranks #${card.otherFormatRank} in ${OTHER_FORMAT[format]}`}
    >
      <span aria-hidden>{better ? "▲" : "▼"}</span>
      {Math.abs(card.rankDelta)} vs {OTHER_FORMAT[format]}
    </span>
  );
}

/** The single featured pickup at the top of a board. */
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
    <article className="rounded-xl border border-edge bg-card p-6 sm:p-7">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.15em] text-orange">{label}</p>
          <h3 className="mt-2 truncate font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            {card.name}
          </h3>
          <p className="mt-1.5 text-sm text-muted">
            {card.position} · {card.team}
            {card.injuryStatus && <span className="text-red"> · {card.injuryStatus}</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="nums font-display text-4xl font-bold leading-none text-teal">
            {card.scoreLabel}
          </p>
          <p className="mt-1.5 text-[0.7rem] uppercase tracking-[0.12em] text-muted">
            {format === "category" ? "Total z" : "Pts / game"}
          </p>
        </div>
      </div>

      <p className="nums mt-6 text-sm text-muted">{card.statLine}</p>

      {(card.tags.length > 0 || card.rankDelta !== null) && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {card.tags.map((t) => (
            <Tag key={t.label} {...t} />
          ))}
          <RankShift card={card} format={format} />
        </div>
      )}
    </article>
  );
}

/** Compact row for everything below the featured pick. */
export function PlayerRow({ card, format }: { card: PlayerCard; format: ScoringFormat }) {
  return (
    <li className="flex items-center gap-4 px-5 py-4 transition hover:bg-card/60">
      <span className="nums w-7 shrink-0 font-display text-lg font-semibold text-muted">
        {card.rank}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="truncate font-medium">{card.name}</span>
          <span className="text-xs text-muted">
            {card.position} · {card.team}
          </span>
          {card.injuryStatus && <span className="text-xs text-red">{card.injuryStatus}</span>}
        </div>
        <p className="nums mt-1 truncate text-xs text-muted">{card.reason ?? card.statLine}</p>
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {card.tags.slice(0, 1).map((t) => (
          <Tag key={t.label} {...t} />
        ))}
        <RankShift card={card} format={format} />
      </div>

      <span className="nums w-16 shrink-0 text-right font-display text-lg font-semibold text-teal">
        {card.scoreLabel}
      </span>
    </li>
  );
}

export function PlayerList({
  cards,
  format,
}: {
  cards: PlayerCard[];
  format: ScoringFormat;
}) {
  return (
    <ul className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-panel">
      {cards.map((c) => (
        <PlayerRow key={c.playerId} card={c} format={format} />
      ))}
    </ul>
  );
}
