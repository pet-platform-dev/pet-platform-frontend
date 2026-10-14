"use client";
import { useLayoutEffect, useRef } from "react";
import type { Message } from "./model";
import { nearBottom } from "./history-scroll";
import { MessageHistory } from "./message-history";

export function ScrollHistory({
  messages,
  hasOlder,
  loadingOlder,
  loadOlder,
  sentId,
}: {
  messages: Message[];
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  sentId?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const position = useRef<{ bottom: boolean; id?: string; offset: number }>({
    bottom: true,
    offset: 0,
  });
  const lastSent = useRef(sentId);
  function remember() {
    const view = viewport.current;
    if (!view) return;
    const top = view.getBoundingClientRect().top;
    const anchor = [
      ...view.querySelectorAll<HTMLElement>("[data-message-id]"),
    ].find((item) => item.getBoundingClientRect().bottom > top);
    position.current = {
      bottom: nearBottom(view),
      id: anchor?.dataset.messageId,
      offset: anchor ? anchor.getBoundingClientRect().top - top : 0,
    };
  }
  useLayoutEffect(() => {
    const view = viewport.current;
    if (!view) return;
    const saved = position.current;
    if (saved.bottom || sentId !== lastSent.current)
      view.scrollTop = view.scrollHeight;
    else if (saved.id) {
      const anchor = view.querySelector<HTMLElement>(
        `[data-message-id="${saved.id}"]`,
      );
      if (anchor)
        view.scrollTop +=
          anchor.getBoundingClientRect().top -
          view.getBoundingClientRect().top -
          saved.offset;
    }
    lastSent.current = sentId;
    remember();
  }, [messages, sentId]);
  return (
    <div
      ref={viewport}
      className="message-viewport"
      tabIndex={0}
      role="region"
      aria-label="Прокручувана історія повідомлень"
      onScroll={() => {
        remember();
        const view = viewport.current;
        if (
          view &&
          view.scrollTop <= 80 &&
          !nearBottom(view) &&
          hasOlder &&
          !loadingOlder
        )
          loadOlder();
      }}
    >
      {loadingOlder && (
        <p className="message-history-loading" role="status">
          Завантаження попередніх повідомлень…
        </p>
      )}
      <MessageHistory messages={messages} reportActions />
    </div>
  );
}
