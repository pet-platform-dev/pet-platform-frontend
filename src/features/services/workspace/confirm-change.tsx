"use client";
import { useEffect, useId, useRef } from "react";
export function ConfirmChange({
  title,
  description,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const active = document.activeElement,
      element = dialog.current,
      overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (active instanceof HTMLElement) active.focus();
    };
  }, []);
  return (
    <dialog
      className="workspace-dialog"
      ref={dialog}
      aria-labelledby={id}
      onCancel={onCancel}
      onClose={() => {
        if (!dialog.current?.open) onCancel();
      }}
    >
      <h2 id={id}>{title}</h2>
      <p>{description}</p>
      <div className="workspace-actions">
        <button
          autoFocus
          type="button"
          className="button secondary"
          onClick={onCancel}
        >
          Скасувати
        </button>
        <button type="button" className="button primary" onClick={onConfirm}>
          Підтвердити
        </button>
      </div>
    </dialog>
  );
}
