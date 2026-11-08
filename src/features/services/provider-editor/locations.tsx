"use client";
import { useState } from "react";
import Link from "next/link";
import { LocationSelector } from "@/entities/location/location-selector";
import { locationSchema, type Location } from "@/entities/location/model";
import {
  listLocations,
  saveLocation,
  removeLocation,
} from "@/entities/service-provider/api";
import type {
  OwnedProvider,
  OwnedLocation,
} from "@/entities/service-provider/model";
import { editable } from "@/entities/service-provider/model";
import {
  useWorkspaceAction,
  useWorkspaceQuery,
  useWorkspaceBusy,
} from "../workspace/session";
import { Feedback, Loading, Select, ConfirmButton } from "../workspace/ui";
type Values = {
  locationId: string;
  kind: "BASE" | "SERVICE_AREA";
  publicAddress: string;
  isPrimary: boolean;
};
export function ProviderLocations({ provider }: { provider: OwnedProvider }) {
  const workspaceBusy = useWorkspaceBusy(provider.id);
  const query = useWorkspaceQuery([provider.id, "locations"], (signal) =>
    listLocations(provider.id, signal),
  );
  const [selected, setSelected] = useState<Location | null>(null),
    [kind, setKind] = useState<Values["kind"]>("BASE"),
    [address, setAddress] = useState(""),
    [primary, setPrimary] = useState(false),
    [editing, setEditing] = useState<OwnedLocation | null>(null),
    [error, setError] = useState<Error | null>(null);
  const save = useWorkspaceAction(
    (values: Values) =>
      saveLocation(
        provider.id,
        values,
        provider.updatedAt,
        editing ?? undefined,
      ),
    provider.id,
  );
  const remove = useWorkspaceAction(
    (row: OwnedLocation) =>
      removeLocation(provider.id, row, provider.updatedAt),
    provider.id,
  );
  const disabled =
    workspaceBusy || !editable(provider) || save.isPending || remove.isPending;
  function reset() {
    setSelected(null);
    setAddress("");
    setEditing(null);
    setKind("BASE");
    setPrimary(false);
    setError(null);
  }
  function edit(row: OwnedLocation) {
    setSelected(locationSchema.parse({ ...row.location, countryCode: "UA" }));
    setAddress(row.publicAddress ?? "");
    setEditing(row);
    setKind(row.kind);
    setPrimary(row.isPrimary);
    setError(null);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) {
      setError(Error("Оберіть місто або село зі списку"));
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({
        locationId: selected.id,
        kind,
        publicAddress: kind === "BASE" ? address : "",
        isPrimary: kind === "BASE" && primary,
      });
      reset();
    } catch {
      /* Inputs remain for recovery. */
    }
  }
  return (
    <section className="workspace-panel" aria-labelledby="provider-locations">
      <h2 id="provider-locations">Місця та території обслуговування</h2>
      <p className="muted">
        Філії — для послуг за вашою адресою. Території — для виїзних послуг.
        Адреса філії буде публічною: не вказуйте домашню адресу, якщо не хочете
        її оприлюднювати.
      </p>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <Feedback error={query.error} onRefresh={() => void query.refetch()} />
      ) : (
        <>
          <ul className="workspace-list">
            {query.data.data.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.location.city}</strong> · {row.location.region}
                  <p>
                    {row.kind === "BASE" ? "Філія" : "Територія обслуговування"}
                    {row.isPrimary ? " · Основна" : ""}
                    {row.publicAddress ? ` · ${row.publicAddress}` : ""}
                    {!row.location.isActive ? " · Неактивне місце" : ""}
                  </p>
                </div>
                <div className="workspace-actions">
                  <button
                    type="button"
                    className="button secondary compact"
                    disabled={disabled}
                    onClick={() => edit(row)}
                  >
                    Редагувати місце
                  </button>
                  <ConfirmButton
                    label="Видалити місце"
                    title="Видалити місце профілю?"
                    description="Місця, пов’язані з послугами, спочатку потрібно прибрати з відповідних пропозицій. Історичні зв’язки можуть забороняти видалення."
                    destructive
                    disabled={disabled}
                    onConfirm={() =>
                      remove.mutateAsync(row).catch(() => undefined)
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
          {!query.data.data.length && (
            <p>Місця ще не додано. Для дистанційних послуг це необов’язково.</p>
          )}
        </>
      )}
      <Feedback error={remove.error} />
      {editable(provider) && (
        <form className="workspace-form" onSubmit={submit}>
          <h3>{editing ? "Редагування місця" : "Додати місце"}</h3>
          <fieldset disabled={disabled}>
            <LocationSelector
              selected={selected}
              onSelect={setSelected}
              label="Місто або село"
            />
            <Select
              label="Роль місця"
              value={kind}
              onChange={(v) => {
                setKind(v as Values["kind"]);
                if (v === "SERVICE_AREA") {
                  setAddress("");
                  setPrimary(false);
                }
              }}
              options={[
                { value: "BASE", label: "Філія" },
                { value: "SERVICE_AREA", label: "Територія обслуговування" },
              ]}
            />
            {kind === "BASE" && (
              <>
                <div className="field">
                  <label htmlFor="provider-address">
                    Публічна адреса (необов’язково)
                  </label>
                  <input
                    id="provider-address"
                    maxLength={300}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <label className="workspace-check">
                  <input
                    type="checkbox"
                    checked={primary}
                    onChange={(e) => setPrimary(e.target.checked)}
                  />
                  Основна філія
                </label>
              </>
            )}
          </fieldset>
          <Feedback error={error ?? save.error} />
          <div className="workspace-actions">
            <button className="button secondary" disabled={disabled}>
              {save.isPending
                ? "Збереження…"
                : editing
                  ? "Зберегти місце"
                  : "Додати місце"}
            </button>
            {editing && (
              <button
                type="button"
                className="button secondary"
                disabled={disabled}
                onClick={reset}
              >
                Скасувати редагування
              </button>
            )}
          </div>
        </form>
      )}
      <Link href={`/my-services/${provider.id}`}>До послуг цього профілю</Link>
    </section>
  );
}
