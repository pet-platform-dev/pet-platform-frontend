"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { hasAdminAccess } from "@/entities/user/permissions";
import { runAdminRequest, currentAdmin } from "../moderation/cache";
import { invalidateContentCaches } from "./cache";
import { contentKey, getContent, getManagedPet, contentHref } from "./api";
import { readSource } from "./navigation";
import { ContentEditor } from "./editor";
import { statusLabels, ownerName, kindLabels, type Content } from "./model";
function Related({
  id,
  title,
  source,
}: {
  id: string;
  title: string;
  source: "LISTING" | "MATING";
}) {
  return (
    <li>
      <Link href={contentHref(id, source)}>{title}</Link>
    </li>
  );
}
export function ManagedPetDetail({ id }: { id: string }) {
  const actor = useSession().data,
    client = useQueryClient();
  const q = useQuery({
    queryKey: contentKey(actor?.id ?? "", "pet", id),
    queryFn: ({ signal }) =>
      runAdminRequest(client, actor!.id, () => getManagedPet(id, signal)),
    enabled: hasAdminAccess(actor?.role),
    retry: false,
  });
  if (!hasAdminAccess(actor?.role)) return null;
  return (
    <section className="admin-management">
      <Link href="/admin/pets">До тварин</Link>
      <h1>Тварина</h1>
      {q.isPending ? (
        <p role="status">Завантажуємо…</p>
      ) : q.isError ? (
        <LoadError retry={() => void q.refetch()} />
      ) : (
        <>
          <dl className="dashboard-card admin-detail-fields">
            {[
              ["Ідентифікатор", q.data.id],
              ["Ім’я", q.data.name || "Не вказано"],
              ["Вид", q.data.species.name],
              [
                "Порода",
                q.data.breed?.nameUk ?? q.data.breed?.name ?? "Не вказано",
              ],
              [
                "Стать",
                { MALE: "Самець", FEMALE: "Самка", UNKNOWN: "Не вказано" }[
                  q.data.gender
                ],
              ],
              ["Народження", q.data.birthDate?.slice(0, 10) ?? "Не вказано"],
              [
                "Видимість",
                q.data.visibility === "PUBLIC" ? "Публічна" : "Приватна",
              ],
              ["Створено", new Date(q.data.createdAt).toLocaleString("uk-UA")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Link href={`/admin/users/${q.data.owner.id}`}>
            {ownerName(q.data.owner)}
          </Link>
          <p className="muted">
            Лише перегляд. Право власності й профіль тварини тут не змінюються.
            Медичні записи та приватний догляд недоступні.
          </p>
          <section>
            <h2>Оголошення ({q.data._count.listings})</h2>
            <ul>
              {q.data.listings.map((l) => (
                <Related key={l.id} {...l} source="LISTING" />
              ))}
            </ul>
          </section>
          <section>
            <h2>В’язка ({q.data._count.matingListings})</h2>
            <ul>
              {q.data.matingListings.map((l) => (
                <Related key={l.id} {...l} source="MATING" />
              ))}
            </ul>
          </section>
          <p className="muted">Показано до 50 останніх записів кожного виду.</p>
        </>
      )}
    </section>
  );
}
function LoadError({ retry }: { retry: () => void }) {
  return (
    <div>
      <p role="alert">
        Не вдалося завантажити запис. Можливо, його не знайдено.
      </p>
      <button className="button secondary" onClick={retry}>
        Спробувати ще раз
      </button>
    </div>
  );
}
export function ManagedContentDetail({ id }: { id?: string }) {
  const actor = useSession().data,
    client = useQueryClient(),
    search = useSearchParams(),
    router = useRouter(),
    source = readSource(search.get("source"));
  const [message, setMessage] = useState("");
  const q = useQuery({
    queryKey: contentKey(actor?.id ?? "", "detail", id, source),
    queryFn: ({ signal }) =>
      runAdminRequest(client, actor!.id, () => getContent(id!, source, signal)),
    enabled: Boolean(id) && hasAdminAccess(actor?.role),
    retry: false,
  });
  if (!hasAdminAccess(actor?.role) || !actor) return null;
  async function saved(row: Content) {
    if (!currentAdmin(client, actor!.id)) return;
    setMessage("Зміни збережено.");
    client.setQueryData(
      contentKey(actor!.id, "detail", row.id, row.source),
      row,
    );
    void client.invalidateQueries({
      queryKey: contentKey(actor!.id, "listings"),
    });
    void invalidateContentCaches(client, actor!.id, row);
    if (!id) router.replace(contentHref(row.id, row.source));
  }
  const row = q.data;
  return (
    <section className="admin-management">
      <Link href={`/admin/listings?source=${id ? source : "OPERATOR_DRAFT"}`}>
        До управління оголошеннями
      </Link>
      <h1>{id ? "Оголошення" : "Підготувати оголошення"}</h1>
      {message && <p role="status">{message}</p>}
      {!id ? (
        <ContentEditor
          row={null}
          breederDraftId={search.get("breederDraftId") ?? undefined}
          breederProfileId={search.get("breederProfileId") ?? undefined}
          onSaved={saved}
        />
      ) : q.isPending ? (
        <p role="status">Завантажуємо…</p>
      ) : q.isError || !row ? (
        <LoadError retry={() => void q.refetch()} />
      ) : (
        <>
          <dl className="dashboard-card admin-detail-fields">
            {[
              ["Ідентифікатор", row.id],
              ["Заголовок", row.title],
              ["Тип", kindLabels[row.type]],
              ["Стан", statusLabels[row.status]],
              [
                "Модерація",
                row.source === "OPERATOR_DRAFT"
                  ? "Приватна підготовка"
                  : statusLabels[row.moderationStatus],
              ],
              [
                "Місце",
                row.location
                  ? [row.location.city, row.location.region].join(", ")
                  : "Не вказано",
              ],
              [
                "Ціна",
                row.price ? `${row.price} ${row.currency}` : "Не вказано",
              ],
              ["Створено", new Date(row.createdAt).toLocaleString("uk-UA")],
              ["Оновлено", new Date(row.updatedAt).toLocaleString("uk-UA")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="admin-content-description">{row.description}</p>
          {row.source === "OPERATOR_DRAFT" ? (
            <p className="muted">
              Не опубліковано. Підготував: {row.createdById}; оновив:{" "}
              {row.updatedById}.
            </p>
          ) : (
            <div className="account-actions">
              <Link href={`/admin/users/${row.owner.id}`}>
                {ownerName(row.owner)}
              </Link>
              <Link href={`/admin/pets/${row.pet.id}`}>
                Тварина: {row.pet.name ?? "Без імені"}
              </Link>
              <Link
                href={`/admin/moderation/${row.source === "LISTING" ? "listings" : "mating-listings"}/${row.id}`}
              >
                Відкрити модерацію
              </Link>
            </div>
          )}
          {row.publicPath && (
            <Link href={row.publicPath}>Публічне оголошення</Link>
          )}
          {row.images.length > 0 && (
            <div className="admin-content-images">
              {row.images.map((i) => (
                <a
                  key={i.id}
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    unoptimized
                    src={i.url}
                    alt="Фото оголошення"
                    width={160}
                    height={120}
                  />
                </a>
              ))}
            </div>
          )}
          {row.status !== "ARCHIVED" &&
            !(row.source === "OPERATOR_DRAFT" && row.transferredAt) && (
              <ContentEditor
                key={row.id + row.updatedAt}
                row={row}
                onSaved={saved}
              />
            )}
          <section>
            <h2>Останні адміністративні зміни</h2>
            {!row.audit?.length ? (
              <p>Адміністративних змін ще немає.</p>
            ) : (
              <ul className="admin-content-audit">
                {row.audit.map((a) => (
                  <li key={a.id}>
                    <time>{new Date(a.createdAt).toLocaleString("uk-UA")}</time>{" "}
                    ·{" "}
                    {{
                      CREATE_DRAFT: "Створено чернетку",
                      UPDATE_DRAFT: "Оновлено чернетку",
                      EDIT_CONTENT: "Змінено матеріали",
                      INTERVENE_STATUS: "Змінено стан",
                    }[a.action] ?? "Оновлено запис"}
                    <p>Адміністратор: {a.actorId}</p>
                    {a.reason && <p>{a.reason}</p>}
                    <p className="muted">Ревізія: {a.revision}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
