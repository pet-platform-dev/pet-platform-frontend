"use client";
import { useId } from "react";
import { getBreeds } from "@/features/pet/api";
import { breedLabel } from "@/entities/breed/model";
import type { Breed } from "@/entities/breed/model";
import { speciesLabel } from "@/entities/species/model";
import { getLocations } from "@/entities/location/api";
import type { Location } from "@/entities/location/model";
import { locationContext } from "@/entities/location/location-selector";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { LargeReferenceSelect } from "@/shared/ui/large-reference-select";
import type { useDirectoryFilters } from "./use-directory-filters";
import { hasDirectoryFilters } from "@/entities/breeder/directory-query";

export function DirectoryFilters({
  filters,
}: {
  filters: ReturnType<typeof useDirectoryFilters>;
}) {
  const id = useId();
  const { query, references, species } = filters;
  return (
    <section
      className="breeder-directory-filters"
      aria-label="Пошук розплідників"
    >
      <div className="breeder-directory-filter-fields">
        <div className="field breeder-directory-search">
          <label htmlFor={id + "-search"}>Пошук</label>
          <input
            id={id + "-search"}
            type="search"
            placeholder="Назва розплідника"
            maxLength={100}
            value={filters.search}
            onChange={(e) => filters.setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={id + "-species"}>Вид тварини</label>
          <SelectDropdown
            label="Вид тварини"
            controlId={id + "-species"}
            value={query.species ?? ""}
            options={[
              { value: "", label: "Усі види" },
              ...(species.data ?? []).map((s) => ({
                value: s.slug,
                label: speciesLabel(s.slug),
              })),
            ]}
            onChange={(value) =>
              filters.setSpecies(
                value === "dog" || value === "cat" ? value : undefined,
              )
            }
          />
          {species.isError && (
            <button
              className="text-button"
              onClick={() => void species.refetch()}
            >
              Повторити завантаження видів
            </button>
          )}
        </div>
        <LargeReferenceSelect<
          Pick<Breed, "id" | "name" | "nameUk" | "speciesId">
        >
          key={query.species ?? "all"}
          label="Порода"
          placeholder="Усі породи"
          hint="Почніть вводити назву породи."
          clearLabel="Очистити породу"
          queryKey={["directory-breeds", query.species]}
          fetchPage={(term, page) => getBreeds(query.species, term, page)}
          itemLabel={breedLabel}
          selected={references.data?.breed ?? null}
          onSelect={(breed) => filters.setBreed(breed?.id)}
          rowHeight={64}
          desktopRowHeight={48}
        />
        <LargeReferenceSelect<Location>
          label="Місто"
          placeholder="Усі міста"
          hint="Введіть назву міста або села — щонайменше 2 символи."
          clearLabel="Очистити місто"
          queryKey={["locations"]}
          fetchPage={getLocations}
          itemLabel={(item) => item.city}
          itemContext={locationContext}
          selected={references.data?.location ?? null}
          onSelect={(item) => filters.setLocation(item?.id)}
          minSearchLength={2}
          rowHeight={128}
          desktopRowHeight={88}
        />
      </div>
      {references.isError && (
        <p role="alert">
          Не вдалося завантажити назви фільтрів.{" "}
          <button
            className="text-button"
            onClick={() => void references.refetch()}
          >
            Спробувати ще раз
          </button>
        </p>
      )}
      {(hasDirectoryFilters(query) || filters.search) && (
        <button className="button secondary" onClick={filters.reset}>
          Скинути фільтри
        </button>
      )}
    </section>
  );
}
