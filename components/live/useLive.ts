"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LivePayload, LivePutBody } from "@/lib/live-types";

/**
 * Polls GET /api/c/[slug]/live. Returns the latest payload plus a clock
 * offset (serverTime - local time) so countdowns agree across devices.
 */
export function useLive(slug: string, intervalMs = 2000) {
  const [data, setData] = useState<LivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const inflight = useRef(false);

  const apply = useCallback((payload: LivePayload, sentAt: number) => {
    const receivedAt = Date.now();
    // Assume the server stamped the payload half-way through the round trip.
    setOffset(payload.serverTime - (sentAt + receivedAt) / 2);
    setData(payload);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    const sentAt = Date.now();
    try {
      const res = await fetch(`/api/c/${slug}/live`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Live feed unavailable (${res.status})`);
        return;
      }
      apply((await res.json()) as LivePayload, sentAt);
    } catch {
      setError("Connection lost — retrying…");
    } finally {
      inflight.current = false;
    }
  }, [slug, apply]);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive && (typeof document === "undefined" || document.visibilityState !== "hidden")) void refresh();
    };
    // Always load once, even in a background tab; only the polling pauses while hidden.
    void refresh();
    const iv = setInterval(tick, intervalMs);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, intervalMs]);

  /** Admin mutation; resolves to an error message or null. */
  const send = useCallback(
    async (body: LivePutBody): Promise<string | null> => {
      const sentAt = Date.now();
      try {
        const res = await fetch(`/api/c/${slug}/live`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return json.error ?? `Request failed (${res.status})`;
        apply(json as LivePayload, sentAt);
        return null;
      } catch {
        return "Network error";
      }
    },
    [slug, apply],
  );

  return { data, error, offset, refresh, send };
}

/** Re-renders every `ms` and returns the (server-corrected) current time. */
export function useNow(offset = 0, ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(iv);
  }, [ms]);
  return now + offset;
}

/** Remaining whole seconds on the pitch timer (null when no timer). */
export function remainingSeconds(timerEndsAt: number | null, now: number): number | null {
  if (!timerEndsAt) return null;
  return Math.max(0, Math.ceil((timerEndsAt - now) / 1000));
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type MyRole = "admin" | "judge" | "participant" | "mentor" | "none" | "anonymous";

/** Current user's role in the contest via GET /api/c/[slug]/users/me. */
export function useMyRole(slug: string) {
  const [role, setRole] = useState<MyRole | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/c/${slug}/users/me`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) return setRole("anonymous");
        if (!res.ok) return setRole("none");
        const json = (await res.json()) as { role?: string };
        const r = json.role;
        setRole(r === "admin" || r === "judge" || r === "participant" || r === "mentor" ? r : "none");
      } catch {
        if (!cancelled) setRole("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return role;
}
