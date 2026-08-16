"use client";

import { Icon } from "./Icon";
import type { Commentary } from "@/lib/types";

/**
 * One analyst callout per view, never one per card, so the voice stays a
 * highlight rather than wallpaper.
 *
 * Rendered as a gold-grounded plate: it is the only element on a board that
 * speaks in sentences, and it should read as the coach's note clipped to the
 * top of the sheet.
 */
export function PersonaCallout({
  commentary,
  loading,
}: {
  commentary: Commentary;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="card">
        <div className="strip flex items-center gap-2 px-5 py-2.5">
          <Icon name="whistle" className="h-3.5 w-3.5" />
          <span className="font-display text-sm">COURTIQ IS WATCHING THE TAPE</span>
        </div>
        <div className="space-y-2.5 bg-bone-2 px-5 py-5">
          <div className="h-3.5 w-full animate-pulse bg-bone-3" />
          <div className="h-3.5 w-4/5 animate-pulse bg-bone-3" />
        </div>
      </div>
    );
  }

  if (!commentary) return null;

  return (
    <figure className="card deal">
      <figcaption className="strip flex items-center justify-between gap-3 px-5 py-2.5">
        <span className="flex items-center gap-2">
          <Icon name="whistle" className="h-3.5 w-3.5" />
          <span className="font-display text-sm">COURTIQ SAYS</span>
        </span>
        {commentary.fallback && (
          <span
            className="border-2 border-bone-3 px-1.5 py-0.5 text-[0.65rem] text-bone-3"
            title="Configure optional Ollama Cloud narration server-side"
          >
            offline read
          </span>
        )}
      </figcaption>
      <blockquote className="bg-gold px-5 py-5 text-lg leading-relaxed text-ink sm:px-6">
        {commentary.text}
      </blockquote>
    </figure>
  );
}
