import Link from "next/link";
import { moderationDate } from "@/features/admin/moderation/presentation";
import type { MessageReportContext as Context } from "./message-context-model";
export function ContextSummary({ context }: { context: Context }) {
  return (
    <header className="report-context-summary">
      <h2>{context.listing.title}</h2>
      {context.listing.breed && <p>{context.listing.breed}</p>}
      <p>{context.participants.map((p) => p.displayName).join(" · ")}</p>
    </header>
  );
}
export function ContextMessages({
  messages,
}: {
  messages: Context["messages"];
}) {
  return (
    <ol className="report-context-messages" aria-label="Контекст повідомлень">
      {messages.map((m) => (
        <li
          key={m.id}
          data-message-id={m.id}
          className={m.isReported ? "is-reported" : ""}
        >
          {m.isReported && (
            <strong className="reported-message-label">
              Повідомлення, на яке поскаржилися
            </strong>
          )}
          <p className="report-message-sender">{m.sender.displayName}</p>
          <p className="admin-full-text">{m.text}</p>
          <time dateTime={m.createdAt}>{moderationDate(m.createdAt)}</time>
        </li>
      ))}
    </ol>
  );
}
export function MessageReportContext({
  id,
  context,
}: {
  id: string;
  context: Context;
}) {
  return (
    <section className="admin-panel">
      <h2>Контекст скарги на повідомлення</h2>
      <ContextSummary context={context} />
      <p className="form-hint">
        До 10 повідомлень до та після повідомлення зі скаргою.
      </p>
      <ContextMessages messages={context.messages} />
      {context.available ? (
        <Link
          className="button secondary"
          prefetch={false}
          href={"/admin/moderation/reports/" + id + "/conversation"}
        >
          Переглянути контекст розмови
        </Link>
      ) : (
        <p>Контекст розмови недоступний. Збережено повідомлення зі скарги.</p>
      )}
    </section>
  );
}
