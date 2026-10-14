"use client";
import { useEffect, useId, useRef } from "react";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { reasonLabels, reportReasons, type ReportReason } from "./model";
export function ReportDialog({
  reason,
  details,
  onReason,
  onDetails,
  onSubmit,
  onClose,
  pending,
  error,
  returnFocus,
  messagePreview,
}: {
  reason: ReportReason;
  details: string;
  onReason: (x: ReportReason) => void;
  onDetails: (x: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  pending: boolean;
  error: string;
  returnFocus: () => void;
  messagePreview?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    first = useRef<HTMLButtonElement | null>(null),
    focusReturn = useRef(returnFocus),
    id = useId();
  useEffect(() => {
    focusReturn.current = returnFocus;
  }, [returnFocus]);
  useEffect(() => {
    const el = dialog.current,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el?.showModal();
    first.current?.focus();
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      // The page outside a modal is inert until close/unmount completes.
      queueMicrotask(() => focusReturn.current());
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="admin-reason-dialog report-dialog"
      aria-labelledby={id + "-title"}
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
            "button:not(:disabled),textarea:not(:disabled)",
          ),
        ).filter((el) => el.getClientRects().length);
        const first = els[0],
          last = els.at(-1);
        if (!first || !last) {
          e.preventDefault();
          return;
        }
        if (
          (e.shiftKey && document.activeElement === first) ||
          (!e.shiftKey && document.activeElement === last)
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }}
    >
      <h2 id={id + "-title"}>
        {messagePreview !== undefined
          ? "Поскаржитися на повідомлення"
          : "Поскаржитися"}
      </h2>
      <p>Опишіть проблему. Скаргу перевірить адміністратор.</p>
      {messagePreview !== undefined && (
        <>
          <blockquote className="report-message-preview">
            {Array.from(messagePreview).slice(0, 200).join("")}
            {Array.from(messagePreview).length > 200 ? "…" : ""}
          </blockquote>
          <p className="form-hint">
            Скарга не закриває розмову й не блокує співрозмовника.
          </p>
        </>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <p className="filter-label">Причина скарги</p>
        <SelectDropdown
          label="Причина скарги"
          value={reason}
          options={reportReasons.map((value) => ({
            value,
            label: reasonLabels[value],
          }))}
          onChange={onReason}
          disabled={pending}
          onFocusRef={(node) => {
            first.current = node;
          }}
        />
        <label htmlFor={id + "-details"}>
          Деталі {reason === "OTHER" ? "" : "(необов’язково)"}
        </label>
        <textarea
          id={id + "-details"}
          rows={5}
          maxLength={1000}
          value={details}
          onChange={(e) => onDetails(e.target.value)}
          required={reason === "OTHER"}
          disabled={pending}
          aria-invalid={!!error}
          aria-describedby={id + "-count" + (error ? " " + id + "-error" : "")}
        />
        <p id={id + "-count"} className="form-hint">
          {reason === "OTHER" ? "Від 10 до 1000 символів" : "До 1000 символів"}{" "}
          · {details.trim().length}/1000
        </p>
        {error && (
          <p role="alert" id={id + "-error"}>
            {error}
          </p>
        )}
        <div className="admin-actions">
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Скасувати
          </button>
          <button className="button primary" disabled={pending}>
            {pending ? "Надсилаємо…" : "Надіслати скаргу"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
