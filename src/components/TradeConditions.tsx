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
  categoryChoices = NBA_CATEGORY_CHOICES,
  intent,
  onChange,
  partnerRoster,
  partnerTeamName,
  myRoster,
  disabled,
}: {
  categoryChoices?: { key: string; label: string }[];
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
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm ">
          What are you after?
        </h3>
        {activeCount > 0 && (
          <button
              type="button"
            disabled={disabled}
            onClick={() =>
              onChange({ wantCategories: [], targetPlayerId: null, protectedPlayerIds: [] })
            }
            className="text-xs text-ink-2 underline-offset-4 hover:text-ink hover:underline disabled:opacity-40"
          >
            Clear all
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-2">
        Optional. Leave it blank and CourtIQ just finds the best imbalance to exploit.
      </p>

      {/* Goal categories */}
      {categoryChoices.length > 0 && <p className="mt-5 text-xs  text-ink-2">I want more…</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {categoryChoices.map((c) => {
          const on = intent.wantCategories.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              disabled={disabled}
              onClick={() => toggleCategory(c.key)}
              aria-pressed={on}
              className={`border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                on
                  ? "border-ink bg-gold text-ink"
                  : "border-ink text-ink-2 hover:text-ink"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Target player */}
      <p className="mt-6 text-xs  text-ink-2">
        Someone specific on {partnerTeamName}?
      </p>
      <select
              aria-label="Target player"
        disabled={disabled}
        value={intent.targetPlayerId ?? ""}
        onChange={(e) => onChange({ ...intent, targetPlayerId: e.target.value || null })}
        className="mt-2.5 w-full border-[3px] border-ink bg-bone-2 px-3 py-2.5 text-sm text-ink [color-scheme:light] focus:bg-chalk focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        <option className="bg-bone text-ink" value="">No preference — find the best fit</option>
        {partnerRoster.map((p) => (
          <option className="bg-bone text-ink" key={p.playerId} value={p.playerId}>
            {p.name} · {p.position} · {p.scoreLabel}
          </option>
        ))}
      </select>

      {/* Untouchables */}
      {myRoster.length > 0 && (
        <>
          <p className="mt-6 text-xs  text-ink-2">
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
                  className={`border px-3 py-1.5 text-xs transition disabled:opacity-40 ${
                    on
                      ? "border-whistle bg-whistle text-bone line-through"
                      : "border-ink text-ink-2 hover:text-ink"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[0.7rem] text-ink-2">
            Your best player is never offered, protected or not.
          </p>
        </>
      )}
    </section>
  );
}
