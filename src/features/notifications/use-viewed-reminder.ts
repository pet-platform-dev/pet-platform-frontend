"use client";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { getUnreadCount, readReminderNotifications } from "./api";
import { notificationKeys, refreshNotifications } from "./cache";
/** Only a visible, focused reminder surface can acknowledge its source notification. */
export function useViewedReminder(
  petId: string,
  reminderId: string,
  enabled: boolean,
) {
  const element = useRef<HTMLElement>(null),
    user = useSession().data,
    client = useQueryClient();
  const count = useQuery({
    queryKey: notificationKeys.unreadCount(user?.id ?? ""),
    queryFn: ({ signal }) => getUnreadCount(signal),
    enabled: !!user && enabled,
  });
  useEffect(() => {
    if (!enabled || !user || !count.data?.count || !element.current) return;
    const abort = new AbortController();
    let intersecting = false,
      sent = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const acknowledge = () => {
      clearTimeout(timer);
      if (
        !intersecting ||
        document.visibilityState !== "visible" ||
        !document.hasFocus() ||
        sent
      )
        return;
      timer = setTimeout(() => {
        sent = true;
        void readReminderNotifications(petId, [reminderId], abort.signal)
          .then((result) => {
            if (!abort.signal.aborted && result.updatedCount > 0)
              void refreshNotifications(client, user.id);
          })
          .catch(() => {
            sent = false;
          });
      }, 450);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        intersecting = entries.some(
          (e) => e.isIntersecting && e.intersectionRatio >= 0.5,
        );
        acknowledge();
      },
      { threshold: 0.5 },
    );
    observer.observe(element.current);
    document.addEventListener("visibilitychange", acknowledge);
    window.addEventListener("focus", acknowledge);
    window.addEventListener("blur", acknowledge);
    return () => {
      clearTimeout(timer);
      abort.abort();
      observer.disconnect();
      document.removeEventListener("visibilitychange", acknowledge);
      window.removeEventListener("focus", acknowledge);
      window.removeEventListener("blur", acknowledge);
    };
  }, [
    enabled,
    user,
    petId,
    reminderId,
    count.data?.count,
    count.dataUpdatedAt,
    client,
  ]);
  return element;
}
