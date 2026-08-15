"use client";

import { useSyncExternalStore } from "react";
import { SESSION_KEY, type Session } from "./types";

/**
 * localStorage is an external store, so read it through the API built for
 * that rather than syncing it into state inside an effect. The snapshot is
 * memoized on the raw string because useSyncExternalStore requires a
 * referentially stable value — re-parsing on every call would loop forever.
 */
let cachedRaw: string | null = null;
let cachedSession: Session | null = null;

function getSnapshot(): Session | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSession = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cachedSession = null;
    }
  }
  return cachedSession;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** Null during server render and on the first hydration pass. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
