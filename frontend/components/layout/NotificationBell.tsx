"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApiNotification } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { token, isDemoSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const isLive = Boolean(token && !isDemoSession && !token.startsWith("demo-"));

  const fetchNotifications = async () => {
    if (!isLive) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.getNotifications(token);
      setNotifications(result.notifications);
      setUnreadCount(result.unread_count);
    } catch {
      setError("Notifications are unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLive) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    void fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isDemoSession]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id, token);
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      // Read state stays unchanged; the list remains usable.
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((item) => !item.is_read);
    await Promise.allSettled(unread.map((item) => api.markNotificationRead(item.id, token)));
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void fetchNotifications();
        }}
        className="relative grid size-10 place-items-center rounded-xl border border-navy-200 bg-white text-navy-500 transition hover:border-primary-200 hover:text-primary-600"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[9px] font-extrabold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-navy-200 bg-white shadow-lift" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
            <p className="text-xs font-extrabold text-navy-900">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-600 hover:underline">
                <CheckCheck className="size-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!isLive ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs font-bold text-navy-700">Sign in to see live notifications</p>
                <p className="mt-1 text-[11px] leading-5 text-navy-500">Outcome updates and verifications appear here for your account.</p>
                <Link href="/login" className="mt-3 inline-flex h-9 items-center rounded-xl bg-primary-600 px-4 text-[11px] font-bold text-white">Sign in</Link>
              </div>
            ) : loading ? (
              <p className="px-4 py-6 text-center text-[11px] text-navy-400">Loading notifications…</p>
            ) : error ? (
              <p className="px-4 py-6 text-center text-[11px] font-bold text-red-600">{error}</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] leading-5 text-navy-500">No notifications yet. Submit an employment update or receive a verification to see them here.</p>
            ) : (
              <ul className="divide-y divide-navy-100">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => { if (!item.is_read) void markRead(item.id); }}
                      className={cn("block w-full px-4 py-3 text-left transition hover:bg-soft-slate", !item.is_read && "bg-primary-50/50")}
                    >
                      <span className="flex items-center gap-2">
                        {!item.is_read && <span className="size-1.5 shrink-0 rounded-full bg-primary-600" />}
                        <span className="text-xs font-extrabold text-navy-900">{item.title}</span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-navy-500">{item.body}</span>
                      <span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-navy-300">{formatDateTime(item.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
