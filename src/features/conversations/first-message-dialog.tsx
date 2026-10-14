"use client";
import { useEffect, useId, useRef } from "react";
import { MessageComposer } from "./message-composer";
import { ConversationThumbnail } from "./conversation-context";
export function FirstMessageDialog({
  title,
  imageUrl,
  onSend,
  onClose,
  returnFocus,
  pending,
}: {
  title: string;
  imageUrl: string | null;
  onSend: (text: string) => Promise<unknown>;
  onClose: () => void;
  returnFocus: () => void;
  pending: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const el = dialog.current,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el?.showModal();
    el?.querySelector("textarea")?.focus();
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="first-message-dialog"
      aria-labelledby={id}
      aria-busy={pending}
      onClose={() => {
        onClose();
        returnFocus();
      }}
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const els = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            "textarea:not(:disabled),button:not(:disabled)",
          ),
        );
        const first = els[0],
          last = els.at(-1);
        if (!first || !last) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <h2 id={id}>Написати продавцю</h2>
      <div className="first-message-context">
        <ConversationThumbnail title={title} url={imageUrl} />
        <strong>{title}</strong>
      </div>
      <MessageComposer onSend={onSend} pending={pending} />
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={() => dialog.current?.close()}
      >
        Скасувати
      </button>
    </dialog>
  );
}
