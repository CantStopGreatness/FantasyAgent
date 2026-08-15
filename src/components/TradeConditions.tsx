"use client";

import { NBA_CATEGORY_CHOICES, type PlayerCard, type TradeIntent } from "@/lib/types";

/**
 * What the manager wants out of this trade.
 *
 * Everything here is optional — with nothing set, CourtIQ reads the positional
 * imbalance exactly as before. Conditions narrow the search rather than
 * replacing it, and they change what "fair" means: a deal that costs a little
 * value but delivers the category you asked for is a good deal.
 */
export function TradeConditions({
  intent,
  onChange,
  partnerRoster,
  partnerTeamName,
  myRoster,
  disabled,
}: {
  intent: TradeIntent;
  onChange: (next: TradeIntent) => void;
  partnerRoster: PlayerCard[];
  partnerTeamName: string;
  myRoster: PlayerCard[];
  disabled?: boolean;
}) {
  const activeCount =
    intent.wantCategories.length +
    (intent.targetPlayerId ? 1 : 0) +
    intent.protectedPlayerIds.length;

  function toggleCategory(key: string) {
    const has = intent.wantCategories.includes(key);
    onChange({
      ...intent,
      wantCategories: has
        ? intent.wantCategories.filter((k) => k !== key)
        : // More than a couple of goals and the search has nothing left to trade for.
          [...intent.wantCategories, key].slice(-3),
    });
  }

  function toggleProtected(playerId: string) {
    const has = intent.protectedPlayerIds.includes(playerId);
    onChange({
      ...intent,
      protectedPlayerIds: has
        ? intent.protectedPlayerIds.filter((id) => id !== playerId)
        : [...intent.protectedPlayerIds, playerId],
    });
  }

  return (
    <section className="rounded-xl border border-edge bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em]">
          What are you after?
        </h3>
        {activeCount > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({ wantCategories: [], targetPlayerId: null, protectedPlayerIds: [] })
            }
            className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
          >
            Clear all
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        Optional. Leave it blank and CourtIQ just finds the best imbalance to exploit.
      </p>

      {/* Goal categories */}
      <p className="mt-5 text-xs uppercase tracking-[0.12em] text-muted">I want more…</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {NBA_CATEGORY_CHOICES.map((c) => {
          const on = intent.wantCategories.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              disabled={disabled}
              onClick={() => toggleCategory(c.key)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                on
                  ? "border-teal bg-teal/15 text-teal"
                  : "border-edge text-muted hover:border-muted/50 hover:text-ink"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Target player */}
      <p className="mt-6 text-xs uppercase tracking-[0.12em] text-muted">
        Someone specific on {partnerTeamName}?
      </p>
      <select
        aria-label="Target player"
        disabled={disabled}
        value={intent.targetPlayerId ?? ""}
        onChange={(e) => onChange({ ...intent, targetPlayerId: e.target.value || null })}
        className="mt-2.5 w-full rounded-lg border border-edge bg-card px-3 py-2.5 text-sm focus:border-teal focus:outline-none disabled:opacity-40"
      >
        <option value="">No preference — find the best fit</option>
        {partnerRoster.map((p) => (
          <option key={p.playerId} value={p.playerId}>
            {p.name} · {p.position} · {p.scoreLabel}
          </option>
        ))}
      </select>

      {/* Untouchables */}
      {myRoster.length > 0 && (
        <>
          <p className="mt-6 text-xs uppercase tracking-[0.12em] text-muted">
            Off the table {intent.protectedPlayerIds.length > 0 && `(${intent.protectedPlayerIds.length})`}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {myRoster.slice(0, 12).map((p) => {
              const on = intent.protectedPlayerIds.includes(p.playerId);
              return (
                <button
                  key={p.playerId}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleProtected(p.playerId)}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-40 ${
                    on
                      ? "border-red/50 bg-red/10 text-red line-through"
                      : "border-edge text-muted hover:border-muted/50 hover:text-ink"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[0.7rem] text-muted">
            Your best player is never offered, protected or not.
          </p>
        </>
      )}
    </section>
  );
}
