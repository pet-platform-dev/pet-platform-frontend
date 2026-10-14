import { messageDate, type Message } from "./model";
export function MessageHistory({ messages }: { messages: Message[] }) {
  return (
    <ol className="message-history" aria-label="Історія повідомлень">
      {messages.map((m) => (
        <li
          key={m.id}
          data-message-id={m.id}
          className={"message-bubble" + (m.isOwn ? " is-own" : "")}
        >
          <span className="message-author">
            {m.isOwn ? "Ви" : "Співрозмовник"}
          </span>
          <p>{m.text}</p>
          <time dateTime={m.createdAt}>{messageDate(m.createdAt)}</time>
        </li>
      ))}
    </ol>
  );
}
