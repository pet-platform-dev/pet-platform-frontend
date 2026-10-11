import { useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { deleteBreeder } from "@/entities/breeder/owner-api";
import { forgetRecoveredForm } from "@/features/listing/form-recovery";
import { updateBreederCache } from "./cache";
export function BreederDelete({
  userId,
  disabled,
  onPending,
}: {
  userId: string;
  disabled: boolean;
  onPending: (pending: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    submitted = useRef(false);
  const client = useQueryClient(),
    router = useRouter();
  const mutation = useMutation({
    retry: false,
    mutationFn: deleteBreeder,
    onSuccess: async () => {
      forgetRecoveredForm(userId + ":breeder");
      dialog.current?.close();
      if (await updateBreederCache(client, userId, null)) {
        router.replace("/account");
        router.refresh();
      }
    },
    onSettled: () => {
      submitted.current = false;
    },
  });
  useEffect(() => {
    onPending(mutation.isPending);
    return () => onPending(false);
  }, [mutation.isPending, onPending]);
  return (
    <section
      className="breeder-delete breeder-media-section"
      aria-labelledby="breeder-danger-title"
    >
      <header className="breeder-section-heading">
        <h2 id="breeder-danger-title">Видалення профілю</h2>
        <p className="muted">
          Видалення інформації про розплідник і його медіа потребує
          підтвердження.
        </p>
      </header>
      <button
        ref={trigger}
        type="button"
        className="button breeder-destructive"
        disabled={disabled || mutation.isPending}
        onClick={() => {
          mutation.reset();
          dialog.current?.showModal();
        }}
      >
        Видалити профіль розплідника
      </button>
      <dialog
        ref={dialog}
        className="delete-dialog"
        aria-labelledby="breeder-delete-title"
        aria-describedby="breeder-delete-help"
        onCancel={(event) => {
          if (mutation.isPending) event.preventDefault();
        }}
        onClose={() => trigger.current?.focus()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const nodes = Array.from(
            dialog.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) ?? [],
          );
          const first = nodes[0],
            last = nodes.at(-1);
          if (
            first &&
            last &&
            ((event.shiftKey && document.activeElement === first) ||
              (!event.shiftKey && document.activeElement === last))
          ) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
        }}
      >
        <h2 id="breeder-delete-title">Видалити профіль розплідника?</h2>
        <p id="breeder-delete-help">
          Буде видалено інформацію про розплідник і вибрані породи. Ваш акаунт,
          тварини, оголошення та контакти залишаться.
        </p>
        <p>
          Логотип, обкладинка, фотографії та посилання на відео розплідника
          також буде видалено.
        </p>
        {mutation.isError && (
          <p role="alert" className="field-error">
            Не вдалося видалити профіль. Спробуйте ще раз.
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            autoFocus
            className="button secondary"
            disabled={mutation.isPending}
            onClick={() => dialog.current?.close()}
          >
            Скасувати
          </button>
          <button
            type="button"
            className="button danger"
            disabled={mutation.isPending}
            onClick={() => {
              if (submitted.current) return;
              submitted.current = true;
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Видаляємо…" : "Видалити профіль"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
