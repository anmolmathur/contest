"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";

type N = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * Small header widget: polls /api/notifications every 60s, shows unread count,
 * opens a dropdown with recent items. Clicking "Mark all read" calls PATCH.
 */
export function NotificationBell() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let stop = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications?limit=20", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { notifications: N[] };
        if (!stop) setItems(data.notifications);
      } catch {}
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [status]);

  if (status !== "authenticated") return null;

  const unread = items.filter((n) => !n.readAt).length;

  async function markRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-slate-300 hover:bg-white/5 hover:text-white"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-white/10 bg-slate-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm text-slate-200">
            <span>Notifications</span>
            {unread > 0 && (
              <button onClick={markRead} className="text-xs text-purple-400 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">No notifications yet.</div>
            ) : (
              items.map((n) => (
                <a
                  key={n.id}
                  href={n.actionUrl ?? "#"}
                  className={`block border-b border-white/5 px-3 py-2 text-sm hover:bg-white/5 ${n.readAt ? "opacity-60" : ""}`}
                >
                  <div className="font-medium text-slate-100">{n.title}</div>
                  {n.body && <div className="mt-0.5 text-xs text-slate-400 line-clamp-2">{n.body}</div>}
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
