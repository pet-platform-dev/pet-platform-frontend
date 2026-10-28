"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useSession } from "@/features/auth/session-provider";
import { hasAdminAccess } from "@/entities/user/permissions";
import { ApiError, currentSessionGeneration } from "@/shared/api/client";
import { currentAdmin, runAdminRequest } from "../moderation/cache";
import { getManagedBreeder, managementKey } from "../management/api";
import { AdminBreederForm } from "../management/breeder-form";
import type { ManagedBreeder } from "../management/model";
import { WorkspaceMedia } from "../breeder-workspace/media";
import { WorkspaceVideos } from "../breeder-workspace/videos";
import { WorkspaceListings } from "../breeder-workspace/listings";
import { WizardContacts } from "./contacts";
import { WizardSummary } from "./summary";
import "../breeder-workspace/workspace.css";
import "./wizard.css";
export const wizardSteps = [
  "Про розплідник",
  "Логотип і банер",
  "Контактні дані",
  "Фотогалерея",
  "Відео",
  "Оголошення",
  "Перевірка та завершення",
] as const;
export function BreederCreationWizard() {
  const actor = useSession().data;
  if (!actor || !hasAdminAccess(actor.role)) return null;
  return <Wizard key={`wizard:${actor.id}`} actorId={actor.id} />;
}
function Wizard({ actorId }: { actorId: string }) {
  const client = useQueryClient(),
    router = useRouter(),
    search = useSearchParams(),
    root = useRef<HTMLElement>(null);
  const rawId = search.get("draftId") ?? search.get("creationId"),
    checked = z.uuid().safeParse(rawId);
  const id = checked.success ? checked.data : undefined;
  const query = useQuery({
    queryKey: managementKey(actorId, "breeder", id, "OPERATOR_PREPARED"),
    queryFn: ({ signal }) =>
      runAdminRequest(client, actorId, () =>
        getManagedBreeder(id!, "OPERATOR_PREPARED", signal),
      ),
    enabled: Boolean(id),
    retry: false,
    staleTime: 0,
  });
  const [recovering] = useState(Boolean(id));
  const profile = query.data;
  const requested = Number(search.get("step") ?? 1),
    step = profile
      ? Math.min(
          6,
          Math.max(0, Number.isInteger(requested) ? requested - 1 : 0),
        )
      : 0;
  const [message, setMessage] = useState("");
  const operation = useRef<string | undefined>(id);
  function url(target: number, draftId?: string, creationId?: string) {
    const params = new URLSearchParams({ step: String(target + 1) });
    if (draftId) params.set("draftId", draftId);
    else if (creationId) params.set("creationId", creationId);
    return `/admin/breeders/new?${params}`;
  }
  function checkpoint() {
    if (!operation.current) operation.current = crypto.randomUUID();
    if (!profile)
      window.history.replaceState(
        window.history.state,
        "",
        url(0, undefined, operation.current),
      );
    return operation.current;
  }
  function go(next: number) {
    if (root.current?.querySelector('[aria-busy="true"]')) {
      setMessage("Зачекайте завершення збереження.");
      return;
    }
    if (
      step === 5 &&
      root.current?.querySelector(".breeder-workspace-editor")
    ) {
      setMessage(
        "Збережіть оголошення або закрийте його редактор перед переходом.",
      );
      return;
    }
    setMessage("");
    router.replace(url(next, profile?.id), { scroll: false });
    root.current?.querySelector<HTMLElement>("h1")?.focus();
  }
  function saved(row: ManagedBreeder) {
    client.setQueryData(
      managementKey(actorId, "breeder", row.id, "OPERATOR_PREPARED"),
      row,
    );
    void client.invalidateQueries({
      queryKey: ["admin-management", actorId, "breeders"],
    });
    router.replace(url(1, row.id), { scroll: false });
  }
  async function refresh() {
    const generation = currentSessionGeneration();
    const row = await query.refetch();
    if (
      generation !== currentSessionGeneration() ||
      !currentAdmin(client, actorId)
    )
      throw new Error("Session changed");
    if (!row.data || row.error) throw new Error("Не вдалося оновити чернетку");
  }
  if (recovering && query.isPending)
    return <p role="status">Відкриваємо збережену чернетку…</p>;
  if (rawId && !checked.success)
    return (
      <p role="alert">
        Некоректне посилання на чернетку.{" "}
        <Link href="/admin/breeders">До розплідників</Link>
      </p>
    );
  if (
    query.isError &&
    !(
      query.error instanceof ApiError &&
      query.error.status === 404 &&
      !search.get("draftId")
    )
  )
    return (
      <section>
        <p role="alert">
          Не вдалося відкрити чернетку. Новий запис не створено.
        </p>
        <button type="button" onClick={() => void query.refetch()}>
          Повторити
        </button>
        <Link href="/admin/breeders">До розплідників</Link>
      </section>
    );
  if (profile?.claimedProfileId)
    return (
      <section>
        <p>Профіль уже отримано власником.</p>
        <Link href={`/admin/breeders/${profile.id}?source=OPERATOR_PREPARED`}>
          Відкрити робоче місце
        </Link>
      </section>
    );
  return (
    <section ref={root} className="admin-management breeder-wizard">
      <Link href="/admin/breeders">До розплідників</Link>
      <p>Крок {step + 1} із 7</p>
      <progress
        value={step + 1}
        max={7}
        aria-label="Прогрес створення розплідника"
      />
      <ol className="wizard-progress">
        {wizardSteps.map((title, index) => (
          <li key={title} aria-current={index === step ? "step" : undefined}>
            {index + 1}. {title}
          </li>
        ))}
      </ol>
      <h1 tabIndex={-1}>{wizardSteps[step]}</h1>
      <p className="muted">
        Усі зміни зберігаються як приватна підготовка. Фото та відео
        зберігаються одразу після додавання. Незавершена чернетка доступна у
        списку розплідників.
      </p>
      {query.isFetching && <p role="status">Оновлюємо чернетку…</p>}
      <section hidden={step !== 0} aria-label="Основні дані майстра">
        <AdminBreederForm
          key={`basic:${actorId}`}
          profile={profile ?? null}
          stage="basic"
          submitLabel="Далі"
          getCreationId={checkpoint}
          onSaved={saved}
        />
      </section>
      {profile && (
        <>
          <section hidden={step !== 1}>
            <WorkspaceMedia
              profile={profile}
              types={["LOGO", "COVER"]}
              heading="Логотип і банер"
              onSaved={refresh}
            />
          </section>
          <section hidden={step !== 2}>
            <WizardContacts
              profile={profile}
              onSaved={async () => {
                await refresh();
                router.replace(url(3, profile.id), { scroll: false });
              }}
            />
          </section>
          <section hidden={step !== 3}>
            <WorkspaceMedia
              profile={profile}
              types={["IMAGE"]}
              heading="Фотогалерея"
              onSaved={refresh}
            />
          </section>
          <section hidden={step !== 4}>
            <WorkspaceVideos profile={profile} onSaved={refresh} />
          </section>
          <section hidden={step !== 5}>
            <WorkspaceListings profile={profile} />
          </section>
          <section hidden={step !== 6}>
            <WizardSummary profile={profile} active={step === 6} />
          </section>
        </>
      )}
      {message && <p role="alert">{message}</p>}
      <nav className="account-actions" aria-label="Кроки створення розплідника">
        {step > 0 && (
          <button
            type="button"
            className="button secondary"
            onClick={() => go(step - 1)}
          >
            Назад
          </button>
        )}
        {step > 0 && step < 6 && (
          <button
            type="button"
            className="button secondary"
            onClick={() => go(step + 1)}
          >
            Пропустити
          </button>
        )}
        {step > 0 && step < 6 && step !== 2 && (
          <button
            type="button"
            className="button primary"
            onClick={() => go(step + 1)}
          >
            Далі
          </button>
        )}
        {step === 6 && (
          <button
            type="button"
            className="button primary"
            onClick={() => {
              if (profile)
                router.replace(
                  `/admin/breeders/${profile.id}?source=OPERATOR_PREPARED`,
                );
            }}
          >
            Завершити створення
          </button>
        )}
      </nav>
    </section>
  );
}
