"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
export function ReminderDialog({
  title,
  children,
  onClose,
  pending,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  pending: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current,
      trigger = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="reminder-dialog"
      aria-labelledby={id}
      aria-busy={pending}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const items = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            "input:not(:disabled),textarea:not(:disabled),button:not(:disabled)",
          ),
        ).filter((el) => !el.closest("fieldset:disabled"));
        const first = items[0],
          last = items.at(-1);
        if (
          first &&
          last &&
          ((e.shiftKey && document.activeElement === first) ||
            (!e.shiftKey && document.activeElement === last))
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }}
    >
      <h2 id={id}>{title}</h2>
      {children}
    </dialog>
  );
}
