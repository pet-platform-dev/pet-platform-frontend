"use client";
import { useState } from "react";
import Link from "next/link";
import {
  listProviders,
  getProvider,
  listOffers,
  getOffer,
} from "@/entities/service-provider/api";
import {
  editable,
  type OwnedProvider,
} from "@/entities/service-provider/model";
import { servicePrice } from "@/entities/service-offer/presentation";
import { ProviderForm } from "../provider-editor/provider-form";
import { ProviderLocations } from "../provider-editor/locations";
import { OfferForm } from "../offer-editor/offer-form";
import { ServiceMediaEditor } from "../media/media-editor";
import { useWorkspaceQuery } from "./session";
import { Feedback, Loading, Status, Pager } from "./ui";
import { ModerationActions } from "./moderation";
import { WorkspaceAudit } from "./audit";
export function MyServiceProviders() {
  const [page, setPage] = useState(1),
    query = useWorkspaceQuery(["mine", page], (signal) =>
      listProviders(page, signal),
    );
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="services-eyebrow">Ваша справа, ближче до людей</p>
          <h1>Мої послуги</h1>
          <p>Профілі спеціалістів і організацій, якими ви керуєте.</p>
        </div>
        <Link href="/my-services/new" className="button primary">
          Створити профіль послуг
        </Link>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Feedback error={query.error} onRefresh={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.data.length ? (
            <section className="workspace-panel">
              <h2>Створіть свій перший профіль</h2>
              <p>
                Представте себе або організацію, додайте послуги й надішліть їх
                на перевірку.
              </p>
            </section>
          ) : (
            <div className="workspace-cards">
              {query.data.data.map((p) => (
                <article className="workspace-panel" key={p.id}>
                  <span className="services-eyebrow">
                    {p.kind === "INDIVIDUAL" ? "Спеціаліст" : "Організація"}
                  </span>
                  <h2>
                    <Link href={`/my-services/${p.id}`}>{p.publicName}</Link>
                  </h2>
                  <Status row={p} />
                  <Link
                    className="button secondary"
                    href={`/my-services/${p.id}`}
                  >
                    Керувати профілем
                  </Link>
                </article>
              ))}
            </div>
          )}
          <Pager page={page} pages={query.data.meta.pages} onChange={setPage} />
        </>
      )}
    </>
  );
}
export function NewServiceProvider() {
  return (
    <>
      <h1>Новий профіль послуг</h1>
      <ProviderForm />
    </>
  );
}
function ProviderOffers({ provider }: { provider: OwnedProvider }) {
  const [page, setPage] = useState(1),
    query = useWorkspaceQuery([provider.id, "offers", page], (signal) =>
      listOffers(provider.id, page, signal),
    );
  return (
    <section className="workspace-panel">
      <div className="workspace-title">
        <h2>Пропозиції послуг</h2>
        {editable(provider) && (
          <Link
            className="button secondary"
            href={`/my-services/${provider.id}/offers/new`}
          >
            Додати послугу
          </Link>
        )}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Feedback error={query.error} onRefresh={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.data.length && (
            <p>Послуг ще немає. Створіть чернетку першої пропозиції.</p>
          )}
          <ul className="workspace-list">
            {query.data.data.map((o) => (
              <li key={o.id}>
                <h3>
                  <Link
                    href={`/my-services/${provider.id}/offers/${o.id}/edit`}
                  >
                    {o.title}
                  </Link>
                </h3>
                <p>
                  {o.category.nameUk} · {servicePrice(o.price)}
                </p>
                <Status row={o} />
                <Link
                  className="button secondary compact"
                  href={`/my-services/${provider.id}/offers/${o.id}/edit`}
                >
                  Керувати послугою
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={page} pages={query.data.meta.pages} onChange={setPage} />
        </>
      )}
    </section>
  );
}
export function ProviderWorkspace({
  providerId,
  editor = false,
}: {
  providerId: string;
  editor?: boolean;
}) {
  const query = useWorkspaceQuery([providerId, "provider"], (signal) =>
    getProvider(providerId, signal),
  );
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <Feedback error={query.error} onRefresh={() => void query.refetch()} />
    );
  const p = query.data;
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="services-eyebrow">
            {p.kind === "INDIVIDUAL" ? "Спеціаліст" : "Організація"}
          </p>
          <h1>{p.publicName}</h1>
        </div>
        <button
          type="button"
          className="button secondary compact"
          onClick={() => void query.refetch()}
        >
          Оновити дані
        </button>
      </div>
      <nav className="workspace-actions" aria-label="Керування профілем">
        <Link
          href={`/my-services/${p.id}`}
          aria-current={!editor ? "page" : undefined}
        >
          Огляд і послуги
        </Link>
        <Link
          href={`/my-services/${p.id}/edit`}
          aria-current={editor ? "page" : undefined}
        >
          Дані, місця та фото
        </Link>
        {p.status === "ACTIVE" && p.moderationStatus === "APPROVED" && (
          <Link href={`/service-providers/${p.id}`}>Публічний профіль</Link>
        )}
      </nav>
      <ModerationActions provider={p} />
      {editor ? (
        <>
          {editable(p) ? (
            <section className="workspace-panel">
              <h2>Дані й публічні контакти</h2>
              <ProviderForm profile={p} />
            </section>
          ) : (
            <p>Цей профіль доступний лише для перегляду.</p>
          )}
          <ProviderLocations provider={p} />
          <ServiceMediaEditor providerId={p.id} readOnly={!editable(p)} />
        </>
      ) : (
        <>
          <ProviderOffers provider={p} />
          <WorkspaceAudit providerId={p.id} />
        </>
      )}
    </>
  );
}
export function OfferWorkspace({
  providerId,
  offerId,
}: {
  providerId: string;
  offerId?: string;
}) {
  const query = useWorkspaceQuery([providerId, "provider"], (signal) =>
    getProvider(providerId, signal),
  );
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <Feedback error={query.error} onRefresh={() => void query.refetch()} />
    );
  return offerId ? (
    <ExistingOffer provider={query.data} offerId={offerId} />
  ) : (
    <>
      <h1>Нова послуга</h1>
      <Link href={`/my-services/${providerId}`}>
        До профілю {query.data.publicName}
      </Link>
      {editable(query.data) ? (
        <OfferForm provider={query.data} />
      ) : (
        <p>Профіль недоступний для створення послуг.</p>
      )}
    </>
  );
}
function ExistingOffer({
  provider,
  offerId,
}: {
  provider: OwnedProvider;
  offerId: string;
}) {
  const query = useWorkspaceQuery([provider.id, "offer", offerId], (signal) =>
    getOffer(provider.id, offerId, signal),
  );
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <Feedback error={query.error} onRefresh={() => void query.refetch()} />
    );
  const offer = query.data,
    canEdit = editable(provider) && editable(offer);
  return (
    <>
      <div className="workspace-title">
        <h1>{offer.title}</h1>
        <button
          className="button secondary compact"
          onClick={() => void query.refetch()}
        >
          Оновити дані
        </button>
      </div>
      <Link href={`/my-services/${provider.id}`}>
        До профілю {provider.publicName}
      </Link>
      <ModerationActions provider={provider} offer={offer} />
      {canEdit ? (
        <section className="workspace-panel">
          <h2>Дані послуги</h2>
          <OfferForm provider={provider} offer={offer} />
        </section>
      ) : (
        <section className="workspace-panel">
          <h2>Дані послуги</h2>
          <p>{offer.description}</p>
          <p>
            {offer.category.nameUk} · {servicePrice(offer.price)}
          </p>
          <p>Цей запис доступний лише для перегляду.</p>
        </section>
      )}
      <ServiceMediaEditor
        providerId={provider.id}
        offerId={offer.id}
        readOnly={!canEdit}
      />
    </>
  );
}
