import { Fragment } from "react";
import {
  messageDate,
  messageDay,
  messageTime,
  historyDay,
  type Message,
} from "./model";
export function MessageHistory({ messages }: { messages: Message[] }) {
  return (
    <ol className="message-history" aria-label="Історія повідомлень">
      {messages.map((m, index) => {
        const previous = messages[index - 1];
        const newDay =
          !previous ||
          messageDay(previous.createdAt) !== messageDay(m.createdAt);
        const consecutive = !newDay && previous.isOwn === m.isOwn;
        return (
          <Fragment key={m.id}>
            {newDay && (
              <li className="message-day">
                <span>{historyDay(m.createdAt)}</span>
              </li>
            )}
            <li
              data-message-id={m.id}
              className={
                "message-bubble" +
                (m.isOwn ? " is-own" : "") +
                (consecutive ? " is-consecutive" : "")
              }
              aria-label={
                m.isOwn ? "Ваше повідомлення" : "Повідомлення співрозмовника"
              }
            >
              <p>{m.text}</p>
              <time
                dateTime={m.createdAt}
                title={messageDate(m.createdAt)}
                aria-label={messageDate(m.createdAt)}
              >
                {messageTime(m.createdAt)}
              </time>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
