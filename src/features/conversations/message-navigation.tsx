"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { getConversationUnreadCount } from "./api";
import { conversationKeys } from "./cache";
import { messageBadge, messageNavigationLabel } from "./model";

export function MessageNavigation({ active = false }: { active?: boolean }) {
  const { data: user } = useSession();
  return user ? (
    <UserMessageNavigation key={user.id} userId={user.id} active={active} />
  ) : null;
}
function UserMessageNavigation({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const unread = useQuery({
    queryKey: conversationKeys.unreadCount(userId),
    queryFn: ({ signal }) => getConversationUnreadCount(signal),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const count = unread.data?.count ?? 0;
  const label = unread.isError
    ? "Повідомлення, кількість непрочитаних недоступна"
    : messageNavigationLabel(count);
  return (
    <Link
      href="/messages"
      className="message-navigation"
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
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
        <path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" />
        <path d="M8 9h8M8 13h5" />
      </svg>
      <span className="message-navigation-text">Повідомлення</span>
      {count > 0 && (
        <span className="message-navigation-count" aria-hidden="true">
          {messageBadge(count)}
        </span>
      )}
    </Link>
  );
}
