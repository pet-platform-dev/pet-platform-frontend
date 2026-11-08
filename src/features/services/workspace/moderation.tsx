"use client";
import Link from "next/link";
import { lifecycleAction } from "@/entities/service-provider/api";
import {
  canSubmit,
  editable,
  type OwnedProvider,
  type OwnedOffer,
} from "@/entities/service-provider/model";
import { useSession } from "@/features/auth/session-provider";
import { useWorkspaceAction, useWorkspaceBusy } from "./session";
import { Status, Feedback, ConfirmButton } from "./ui";
export function ModerationActions({
  provider,
  offer,
}: {
  provider: OwnedProvider;
  offer?: OwnedOffer;
}) {
  const workspaceBusy = useWorkspaceBusy(provider.id);
  const row = offer ?? provider,
    { data: user } = useSession(),
    action = useWorkspaceAction(
      (kind: "submit" | "archive") =>
        lifecycleAction(provider.id, kind, row.updatedAt, offer?.id),
      provider.id,
    );
  const parentReady =
      provider.status === "ACTIVE" && provider.moderationStatus === "APPROVED",
    vet = offer?.category.slug === "veterinary-care",
    verified = user?.verificationStatus === "VERIFIED",
    canEdit = editable(provider) && editable(row);
  return (
    <section className="workspace-panel">
      <h2>Публікація та модерація</h2>
      <Status row={row} />
      {!verified && (
        <p>
          Для надсилання потрібно{" "}
          <Link href="/account">підтвердити електронну пошту</Link>.
        </p>
      )}
      {offer && !parentReady && (
        <p role="status">
          Спочатку профіль надавача має бути активним і схваленим. До того часу
          можна готувати чернетки послуг.
        </p>
      )}
      {vet && (
        <p role="status">
          Публікація ветеринарної послуги заблокована до впровадження перевірки
          у S10.
        </p>
      )}
      {row.moderationStatus === "HIDDEN" && (
        <p>
          Прихований запис доступний лише для перегляду. Повернути його на
          доопрацювання може адміністратор.
        </p>
      )}
      <Feedback
        error={action.error}
        success={action.isSuccess ? "Дію виконано." : undefined}
      />
      <div className="workspace-actions">
        {canSubmit(row) && (
          <ConfirmButton
            label="Надіслати на модерацію"
            title="Надіслати запис на перевірку?"
            description="Перед надсиланням збережіть форму. Перевірятиметься збережена версія; публікація відбудеться лише після схвалення."
            disabled={
              workspaceBusy ||
              action.isPending ||
              !verified ||
              Boolean(offer && !parentReady) ||
              !canEdit
            }
            onConfirm={() =>
              action.mutateAsync("submit").catch(() => undefined)
            }
          />
        )}
        {row.status !== "ARCHIVED" && (!offer || canEdit) && (
          <ConfirmButton
            label="Архівувати"
            title="Архівувати запис?"
            description="Запис зникне з публічних сторінок. Відновлення з архіву в поточній версії недоступне; дані й фотографії зберігаються."
            destructive
            disabled={workspaceBusy || action.isPending}
            onConfirm={() =>
              action.mutateAsync("archive").catch(() => undefined)
            }
          />
        )}
      </div>
    </section>
  );
}
