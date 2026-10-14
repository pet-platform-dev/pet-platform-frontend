export function MessagesLoading({
  kind,
}: {
  kind: "inbox" | "conversation" | "history";
}) {
  return (
    <div className="messages-skeleton" role="status">
      <span className="visually-hidden">
        {kind === "inbox"
          ? "Завантаження розмов…"
          : kind === "conversation"
            ? "Завантаження розмови…"
            : "Завантаження повідомлень…"}
      </span>
      {kind === "inbox" ? (
        [0, 1, 2].map((key) => (
          <div className="conversation-card" aria-hidden="true" key={key}>
            <span className="conversation-thumbnail skeleton-block" />
            <div className="skeleton-lines">
              <span />
              <span />
              <span />
            </div>
          </div>
        ))
      ) : (
        <>
          {kind === "conversation" && (
            <div className="conversation-context" aria-hidden="true">
              <span className="conversation-thumbnail skeleton-block" />
              <div className="skeleton-lines">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div className="message-viewport" aria-hidden="true">
            <div className="skeleton-message" />
            <div className="skeleton-message is-own" />
            <div className="skeleton-message" />
          </div>
          {kind === "conversation" && (
            <div
              className="message-composer skeleton-composer"
              aria-hidden="true"
            >
              <div className="skeleton-lines">
                <span />
                <span />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
