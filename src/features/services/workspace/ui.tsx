"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Lifecycle } from "@/entities/service-provider/model";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { workspaceError } from "./session";
export function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <SelectDropdown
        controlId={id}
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
      />
    </div>
  );
}
export function Feedback({
  error,
  success,
  onRefresh,
}: {
  error?: unknown;
  success?: string;
  onRefresh?: () => void;
}) {
  return (
    <>
      {error && (
        <div className="workspace-feedback" role="alert">
          <p>{workspaceError(error)}</p>
          {onRefresh && (
            <button
              type="button"
              className="button secondary compact"
              onClick={onRefresh}
            >
              Оновити дані
            </button>
          )}
        </div>
      )}
      {success && (
        <p className="workspace-feedback" role="status">
          {success}
        </p>
      )}
    </>
  );
}
const moderation = {
  NOT_SUBMITTED: "Не надіслано",
  PENDING: "На модерації",
  APPROVED: "Схвалено",
  REJECTED: "Відхилено",
  HIDDEN: "Приховано",
};
export function Status({ row }: { row: Lifecycle }) {
  return (
    <div className="workspace-status">
      <span className="catalog-chip">
        {row.status === "ARCHIVED"
          ? "Архів"
          : row.status === "ACTIVE"
            ? "Активний запис"
            : "Чернетка"}{" "}
        · {moderation[row.moderationStatus]}
      </span>
      {row.moderationReason && (
        <p>
          <strong>Причина модерації: </strong>
          {row.moderationReason}
        </p>
      )}
      {row.moderationStatus === "APPROVED" && (
        <p className="muted">
          Зміни приховають цей запис до повторної модерації. Зміни профілю також
          тимчасово приховають його послуги.
        </p>
      )}
    </div>
  );
}
export function Pager({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return pages > 1 ? (
    <nav className="workspace-actions" aria-label="Сторінки робочого простору">
      <button
        className="button secondary compact"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Попередня
      </button>
      <span aria-live="polite">
        {page} / {pages}
      </span>
      <button
        className="button secondary compact"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Наступна
      </button>
    </nav>
  ) : null;
}
export function ConfirmButton({
  label,
  title,
  description,
  onConfirm,
  disabled = false,
  destructive = false,
}: {
  label: string;
  title: string;
  description: string;
  onConfirm: () => void | Promise<unknown>;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    const element = dialog.current,
      opener = trigger.current,
      overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        className={`button secondary compact${destructive ? " danger" : ""}`}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="workspace-dialog"
          aria-labelledby={id}
          onCancel={() => setOpen(false)}
          onClose={() => setOpen(false)}
        >
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
          <div className="workspace-actions">
            <button
              autoFocus
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
            >
              Скасувати
            </button>
            <button
              type="button"
              className={`button ${destructive ? "secondary danger" : "primary"}`}
              onClick={() => {
                setOpen(false);
                void onConfirm();
              }}
            >
              Підтвердити
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
export function Loading() {
  return <p role="status">Завантаження…</p>;
}
