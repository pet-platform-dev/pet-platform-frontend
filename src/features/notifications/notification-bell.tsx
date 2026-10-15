"use client";
import { useMotionPresence } from "@/shared/hooks/use-motion-presence";
import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import {
  getNotifications,
  getUnreadCount,
  readAllNotifications,
  readNotification,
} from "./api";
import { notificationKeys, refreshNotifications } from "./cache";
import { notificationCount, notificationLabel } from "./model";
import { NotificationPanel } from "./notification-panel";

export function NotificationBell() {
  const { data: user } = useSession();
  return user ? <UserNotificationBell key={user.id} userId={user.id} /> : null;
}
function UserNotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1);
  const present = useMotionPresence(open);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId();
  const client = useQueryClient();
  const count = useQuery({
    queryKey: notificationKeys.unreadCount(userId),
    queryFn: ({ signal }) => getUnreadCount(signal),
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });
  const list = useQuery({
    queryKey: notificationKeys.list(userId, page),
    queryFn: ({ signal }) => getNotifications(page, signal),
    enabled: open,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const mutation = useMutation({
    mutationKey: notificationKeys.root(userId),
    mutationFn: (notificationId: string | null) =>
      notificationId
        ? readNotification(notificationId).then(() => undefined)
        : readAllNotifications().then(() => undefined),
    onSettled: () => refreshNotifications(client, userId),
  });
  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLElement>(
        ".notification-panel button:not(:disabled), .notification-panel a",
      )
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const unread = count.data?.count ?? 0;
  const focusPanel = () =>
    root.current
      ?.querySelector<HTMLElement>(".notification-panel")
      ?.focus({ preventScroll: true });
  return (
    <div
      className="notification-root"
      ref={root}
      onBlur={(event) => {
        // Loading/disabled actions can lose focus without moving it outside.
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="notification-trigger"
        aria-label={notificationLabel(unread)}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          if (!open) {
            void count.refetch();
            mutation.reset();
          }
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unread > 0 && (
          <span key={unread} className="notification-count" aria-hidden="true">
            {notificationCount(unread)}
          </span>
        )}
      </button>
      {present && (
        <NotificationPanel
          open={open}
          id={id}
          count={unread}
          page={page}
          data={list.data}
          pending={list.isPending}
          error={list.isError || count.isError}
          mutating={mutation.isPending}
          mutationError={mutation.isError}
          onRetry={() => {
            void list.refetch();
            void count.refetch();
          }}
          onPage={(next) => {
            focusPanel();
            setPage(next);
            mutation.reset();
          }}
          onRead={(notificationId) => {
            focusPanel();
            mutation.mutate(notificationId);
          }}
          onReadAll={() => {
            focusPanel();
            mutation.mutate(null);
          }}
        />
      )}
    </div>
  );
}
