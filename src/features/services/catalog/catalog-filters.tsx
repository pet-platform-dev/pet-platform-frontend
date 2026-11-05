"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { LargeReferenceSelect } from "@/shared/ui/large-reference-select";
import { getLocations } from "@/entities/location/api";
import { getRegions } from "@/entities/location/regions";
import { locationContext } from "@/entities/location/location-selector";
import type { Location } from "@/entities/location/model";
import type { ServiceCategory } from "@/entities/service-offer/model";
import {
  serviceQuerySchema,
  serviceHref,
  type ServiceQuery,
} from "@/entities/service-offer/query";
export function ServiceCatalogFilters({
  query,
  base,
  categories,
  location,
  fixedCategory = false,
}: {
  query: ServiceQuery;
  base: string;
  categories: ServiceCategory[];
  location: Location | null;
  fixedCategory?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const id = useId(),
    router = useRouter();
  const [draft, setDraft] = useState(query),
    [city, setCity] = useState(location),
    [error, setError] = useState("");
  const regions = useQuery({
    queryKey: ["regions"],
    queryFn: getRegions,
    staleTime: 300000,
  });
  const set = (key: keyof ServiceQuery, value: string) =>
    setDraft((s) => ({ ...s, [key]: value || undefined }));
  function select(
    label: string,
    key: keyof ServiceQuery,
    options: { value: string; label: string }[],
  ) {
    return (
      <div className="field" key={key}>
        <label htmlFor={id + key}>{label}</label>
        <SelectDropdown
          controlId={id + key}
          label={label}
          value={String(draft[key] ?? "")}
          options={options}
          onChange={(v) => {
            if (key === "mode" && v === "REMOTE") {
              setCity(null);
              setDraft((s) => ({
                ...s,
                mode: "REMOTE",
                locationId: undefined,
                regionId: undefined,
              }));
            } else if (key === "regionId") {
              setCity(null);
              setDraft((s) => ({
                ...s,
                regionId: v || undefined,
                locationId: undefined,
              }));
            } else set(key, v);
          }}
        />
      </div>
    );
  }
  return (
    <form
      className="services-filters"
      aria-label="Пошук послуг"
      onSubmit={(e) => {
        e.preventDefault();
        const result = serviceQuerySchema.safeParse({ ...draft, page: 1 });
        if (!result.success) {
          setError(
            "Перевірте фільтри. Для пошуку введіть щонайменше 2 символи.",
          );
          return;
        }
        setError("");
        startTransition(() => router.push(serviceHref(base, result.data)));
      }}
    >
      <div className="services-filter-grid">
        <div className="field">
          <label htmlFor={id + "search"}>Пошук</label>
          <input
            id={id + "search"}
            type="search"
            maxLength={100}
            placeholder="Послуга або назва надавача"
            value={draft.q ?? ""}
            onChange={(e) => set("q", e.target.value)}
          />
        </div>
        {!fixedCategory &&
          select("Категорія", "category", [
            { value: "", label: "Усі категорії" },
            ...categories.map((c) => ({ value: c.slug, label: c.nameUk })),
          ])}
        {select("Надавач", "providerKind", [
          { value: "", label: "Усі надавачі" },
          { value: "INDIVIDUAL", label: "Спеціалісти" },
          { value: "ORGANIZATION", label: "Організації" },
        ])}
        {select("Вид тварини", "species", [
          { value: "", label: "Усі види" },
          { value: "dog", label: "Собаки" },
          { value: "cat", label: "Коти" },
        ])}
        {select("Формат", "mode", [
          { value: "", label: "Усі формати" },
          { value: "ONSITE", label: "За адресою надавача" },
          { value: "MOBILE", label: "З виїздом" },
          { value: "REMOTE", label: "Дистанційно" },
        ])}
        {select("Ціна", "priceModel", [
          { value: "", label: "Усі моделі ціни" },
          { value: "FIXED", label: "Фіксована" },
          { value: "FROM", label: "Від указаної суми" },
          { value: "ON_REQUEST", label: "За запитом" },
        ])}
        {draft.mode !== "REMOTE" && (
          <>
            <LargeReferenceSelect<Location>
              label="Місто"
              placeholder="Усі міста"
              hint="Введіть назву міста або села — щонайменше 2 символи."
              queryKey={["locations"]}
              fetchPage={getLocations}
              minSearchLength={2}
              selected={city}
              itemLabel={(r) => r.city}
              itemContext={locationContext}
              onSelect={(r) => {
                setCity(r);
                setDraft((s) => ({
                  ...s,
                  locationId: r?.id,
                  regionId: undefined,
                }));
              }}
              rowHeight={128}
              desktopRowHeight={88}
            />
            {select("Область", "regionId", [
              { value: "", label: "Усі області" },
              ...(regions.data ?? []).map((r) => ({
                value: r.id,
                label: r.name,
              })),
            ])}
          </>
        )}
        {select("Сортування", "sort", [
          { value: "newest", label: "Спочатку нові" },
          { value: "name_asc", label: "За назвою" },
        ])}
      </div>
      {regions.isError && (
        <p role="status">
          Не вдалося завантажити області.{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => void regions.refetch()}
          >
            Повторити
          </button>
        </p>
      )}
      {query.locationId && !location && (
        <p className="muted">
          Збережений населений пункт недоступний. Оберіть інший або скиньте
          фільтри.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="services-actions">
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Завантаження…" : "Застосувати"}
        </button>
        <a className="button secondary" href={base}>
          Скинути фільтри
        </a>
      </div>
    </form>
  );
}
