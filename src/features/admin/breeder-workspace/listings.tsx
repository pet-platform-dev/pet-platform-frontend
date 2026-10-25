"use client";
import Image from "next/image";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import {
  authenticatedRequest,
  currentSessionGeneration,
} from "@/shared/api/client";
import { runAdminRequest, currentAdmin } from "../moderation/cache";
import { getContentList } from "../content/api";
import { invalidateContentCaches } from "../content/cache";
import { WorkspaceHandoffs } from "./handoffs";
import { ContentEditor } from "../content/editor";
import {
  statusLabels,
  kindLabels,
  type Content,
  type ContentSource,
} from "../content/model";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import type { ManagedBreeder } from "../management/model";
export function WorkspaceListings({ profile }: { profile: ManagedBreeder }) {
  const actor = useSession().data!,
    client = useQueryClient();
  const [source, setSource] = useState<ContentSource>("OPERATOR_DRAFT"),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<Content | null | undefined>(undefined),
    [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const preparationId =
    profile.source === "OPERATOR_PREPARED"
      ? profile.id
      : profile.preparationDraftId;
  const canPrepare =
    profile.source === "OPERATOR_PREPARED" ||
    profile.user?.accountType === "BREEDER";
  const handoffId = preparationId ?? profile.id;
  const handoffSource = preparationId ? "OPERATOR_PREPARED" : "OWNER_MANAGED";
  const claimed = Boolean(
    profile.claimedProfileId || profile.source === "OWNER_MANAGED",
  );
  const params = new URLSearchParams({
    source,
    page: String(page),
    limit: "10",
    [profile.source === "OPERATOR_PREPARED"
      ? "breederDraftId"
      : "breederProfileId"]: profile.id,
  });
  const query = useQuery({
    queryKey: [
      "admin-management",
      actor.id,
      "workspace-listings",
      profile.id,
      source,
      page,
    ],
    queryFn: ({ signal }) =>
      runAdminRequest(client, actor.id, () =>
        getContentList(params, false, signal),
      ),
    retry: false,
  });
  const rows = (query.data?.data ?? []).filter(
    (r): r is Content => "source" in r,
  );
  async function propose() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const generation = currentSessionGeneration();
    try {
      await runAdminRequest(client, actor.id, () =>
        authenticatedRequest(`/admin/breeders/${handoffId}/handoffs`, {
          method: "POST",
          body: JSON.stringify({
            source: handoffSource,
            items: rows
              .filter((r) => selected.includes(r.id))
              .map((r) => ({ id: r.id, expectedUpdatedAt: r.updatedAt })),
          }),
        }),
      );
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      ) {
        setMessage(
          "Власник може переглянути й прийняти вибрані оголошення в редакторі розплідника.",
        );
        setSelected([]);
        void client.invalidateQueries({
          queryKey: [
            "admin-management",
            actor.id,
            "workspace-handoffs",
            preparationId,
          ],
        });
      }
    } catch {
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      )
        setMessage(
          "Передачу не створено. Перевірте власника, вибрані чернетки та оновіть дані.",
        );
    } finally {
      if (generation === currentSessionGeneration()) setBusy(false);
    }
  }
  return (
    <section className="dashboard-card">
      <h2>Оголошення</h2>
      <SelectDropdown
        label="Матеріали розплідника"
        value={source}
        options={[
          ["OPERATOR_DRAFT", "Підготовлені чернетки"],
          ["LISTING", "Оголошення власника"],
          ["MATING", "В’язка власника"],
        ].map(([value, label]) => ({ value, label }))}
        onChange={(v) => {
          setSource(v as ContentSource);
          setPage(1);
          setSelected([]);
          setEditor(undefined);
        }}
      />
      {canPrepare && (preparationId || profile.source === "OWNER_MANAGED") && (
        <button className="button primary" onClick={() => setEditor(null)}>
          Додати оголошення
        </button>
      )}
      {editor !== undefined && (
        <section className="breeder-workspace-editor">
          <h3>
            {editor ? "Редагувати оголошення" : "Нове оголошення розплідника"}
          </h3>
          <ContentEditor
            key={editor?.id ?? "new"}
            row={editor}
            breederDraftId={preparationId ?? undefined}
            breederProfileId={
              !preparationId && profile.source === "OWNER_MANAGED"
                ? profile.id
                : undefined
            }
            onSaved={(row) => {
              setEditor(undefined);
              setSelected([]);
              void query.refetch();
              void invalidateContentCaches(client, actor.id, row);
              void client.invalidateQueries({
                queryKey: ["admin-management", actor.id, "content"],
              });
            }}
          />
          <button
            className="button secondary"
            onClick={() => setEditor(undefined)}
          >
            Закрити редактор
          </button>
        </section>
      )}
      {query.isPending ? (
        <p role="status">Завантажуємо оголошення…</p>
      ) : query.isError ? (
        <p role="alert">
          Не вдалося завантажити.{" "}
          <button onClick={() => void query.refetch()}>Повторити</button>
        </p>
      ) : rows.length === 0 ? (
        <p>Пов’язаних оголошень ще немає.</p>
      ) : (
        <ul className="breeder-workspace-list">
          {rows.map((row) => (
            <li key={row.id}>
              {row.images[0] && (
                <Image
                  unoptimized
                  src={row.images[0].url}
                  width={120}
                  height={90}
                  alt="Головне фото оголошення"
                />
              )}
              <div>
                <h3>{row.title}</h3>
                <p>
                  {kindLabels[row.type]} · {statusLabels[row.status]} ·{" "}
                  {row.source === "OPERATOR_DRAFT"
                    ? "Приватна підготовка"
                    : statusLabels[row.moderationStatus]}
                </p>
                <p>
                  {row.source === "OPERATOR_DRAFT"
                    ? [row.species?.name, row.breed?.nameUk ?? row.breed?.name]
                        .filter(Boolean)
                        .join(" · ")
                    : [
                        row.pet.species.name,
                        row.pet.breed?.nameUk ?? row.pet.breed?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
                <p>
                  {row.price ? `${row.price} грн` : "Ціну не вказано"} ·{" "}
                  {row.location?.city ?? "Місце не вказано"} ·{" "}
                  {new Date(row.createdAt).toLocaleDateString("uk-UA")}
                </p>
                {row.source === "OPERATOR_DRAFT" && row.transferredAt ? (
                  <p>Передано власнику</p>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() => setEditor(row)}
                  >
                    Редагувати
                  </button>
                )}
                {row.publicPath && <a href={row.publicPath}>Переглянути</a>}
                {claimed &&
                  row.source === "OPERATOR_DRAFT" &&
                  !row.transferredAt &&
                  row.kind !== "MATING" &&
                  row.status !== "ARCHIVED" && (
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(e) =>
                          setSelected((old) =>
                            e.target.checked
                              ? [...old, row.id]
                              : old.filter((id) => id !== row.id),
                          )
                        }
                      />{" "}
                      Вибрати для передачі власнику
                    </label>
                  )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {(query.data?.meta.pages ?? 0) > 1 && (
        <nav
          aria-label="Сторінки оголошень розплідника"
          className="account-actions"
        >
          <button
            disabled={page === 1}
            onClick={() => {
              setPage((p) => p - 1);
              setSelected([]);
            }}
          >
            Попередня
          </button>
          <span>
            {page} / {query.data?.meta.pages}
          </span>
          <button
            disabled={page >= query.data!.meta.pages}
            onClick={() => {
              setPage((p) => p + 1);
              setSelected([]);
            }}
          >
            Наступна
          </button>
        </nav>
      )}
      {selected.length > 0 && (
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void propose()}
        >
          Запропонувати передачу ({selected.length})
        </button>
      )}
      {message && <p role="status">{message}</p>}
      {claimed && (
        <WorkspaceHandoffs draftId={handoffId} source={handoffSource} />
      )}
    </section>
  );
}
