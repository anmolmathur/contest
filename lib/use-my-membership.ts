"use client";

import { useCallback, useEffect, useState } from "react";

/** Shape of GET /api/c/[slug]/users/me (subset used by client pages). */
export interface MyMembership {
  id: string;
  role: "admin" | "judge" | "participant" | "mentor" | "validator";
  participantRole: string | null;
  extraRoles?: string[] | null;
  teamId: string | null;
  platformOverride?: boolean;
  user?: { id: string; name: string | null; email: string; department: string | null } | null;
}

/**
 * Current viewer's membership in a contest. `status` is "anon" when signed
 * out and "none" when signed in but not enrolled.
 */
export function useMyMembership(slug: string) {
  const [me, setMe] = useState<MyMembership | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "anon" | "none">("loading");

  const fetchMe = useCallback(async (): Promise<{ me: MyMembership | null; status: "ok" | "anon" | "none" }> => {
    try {
      const res = await fetch(`/api/c/${slug}/users/me`, { cache: "no-store" });
      if (res.status === 401) return { me: null, status: "anon" };
      if (!res.ok) return { me: null, status: "none" };
      return { me: (await res.json()) as MyMembership, status: "ok" };
    } catch {
      return { me: null, status: "none" };
    }
  }, [slug]);

  const reload = useCallback(async () => {
    const r = await fetchMe();
    setMe(r.me);
    setStatus(r.status);
  }, [fetchMe]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchMe();
      if (cancelled) return;
      setMe(r.me);
      setStatus(r.status);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  return { me, status, reload };
}
