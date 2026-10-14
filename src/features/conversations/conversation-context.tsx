import Link from "next/link";
import { SafeImage } from "@/shared/ui/safe-image";
import { messageDate, conversationHref, type Conversation } from "./model";
export function ConversationThumbnail({
  url,
  title,
}: {
  url: string | null;
  title: string;
}) {
  return (
    <div className="conversation-thumbnail">
      <SafeImage
        src={url ?? undefined}
        alt={title}
        width={80}
        height={80}
        fallback={
          <span role="img" aria-label="Фото оголошення недоступне">
            ◇
          </span>
        }
      />
    </div>
  );
}
export function ConversationCard({
  conversation: c,
}: {
  conversation: Conversation;
}) {
  return (
    <Link
      className={"conversation-card" + (c.unreadCount ? " is-unread" : "")}
      href={conversationHref(c.id)}
    >
      <ConversationThumbnail url={c.listing.imageUrl} title={c.listing.title} />
      <div className="conversation-card-content">
        <strong>{c.listing.title}</strong>
        {c.listing.breed && <p className="muted">{c.listing.breed}</p>}
        <p>{c.otherParticipant.displayName}</p>
        {c.unreadCount > 0 && (
          <span className="conversation-unread">
            ● Непрочитаних: {c.unreadCount}
          </span>
        )}
        {c.lastMessage && (
          <p className="conversation-preview">
            {c.lastMessage.isOwn ? "Ви: " : ""}
            {c.lastMessage.text}
          </p>
        )}
        <time dateTime={c.lastMessageAt}>{messageDate(c.lastMessageAt)}</time>
      </div>
    </Link>
  );
}
export function ConversationContext({
  conversation: c,
}: {
  conversation: Conversation;
}) {
  return (
    <section
      className="conversation-context"
      aria-label="Оголошення та співрозмовник"
    >
      <ConversationThumbnail url={c.listing.imageUrl} title={c.listing.title} />
      <div>
        <h2>{c.listing.title}</h2>
        {c.listing.breed && <p className="muted">{c.listing.breed}</p>}
        <p>{c.otherParticipant.displayName}</p>
        {c.listing.available && c.listing.href ? (
          <Link href={c.listing.href} className="conversation-public-link">
            Переглянути оголошення
          </Link>
        ) : (
          <p className="muted">Оголошення більше не активне</p>
        )}
      </div>
    </section>
  );
}
