import { nbaProfile } from "./nba";
import type { SportId, SportProfile } from "./types";

export * from "./types";
export { nbaProfile };

/**
 * Sports CourtIQ can actually score today. Imported leagues without a profile
 * are refused rather than guessed at.
 */
export const SPORT_PROFILES: Partial<Record<SportId, SportProfile>> = {
  nba: nbaProfile,
};

export const DEFAULT_SPORT: SportId = "nba";

export function getProfile(sport: string): SportProfile | null {
  return SPORT_PROFILES[sport as SportId] ?? null;
}

export function supportedSportLabels(): string {
  return Object.values(SPORT_PROFILES)
    .map((p) => p!.label)
    .join(", ");
}
