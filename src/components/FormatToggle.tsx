"use client";

import type { ScoringFormat } from "@/lib/types";

/**
 * The demo's centerpiece control. Kept visually loud on purpose — flipping it
 * re-ranks every list in the app.
 */
export function FormatToggle({
  value,
  onChange,
  disabled,
}: {
  value: ScoringFormat;
  onChange: (f: ScoringFormat) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="League scoring format"
      className="inline-flex rounded-lg border border-edge bg-panel p-1"
    >
      {(
        [
          ["category", "9-CAT"],
          ["points", "Points"],
        ] as const
      ).map(([f, label]) => {
        const active = value === f;
        return (
          <button
            key={f}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(f)}
            className={`rounded-md px-4 py-1.5 font-display text-sm font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed ${
              active
                ? "bg-teal text-[#03212a]"
                : "text-muted hover:text-ink disabled:hover:text-muted"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
