import { SpeciesFilter } from "@/features/listing/filters/species-filter";
import { BreedFilter } from "@/features/listing/filters/breed-filter";
import { RegionFilter } from "@/features/listing/filters/region-filter";
import { LocationFilter } from "@/features/listing/filters/location-filter";
import { AgeFilter } from "@/features/listing/filters/age-filter";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import type { MatingValues, MatingUpdate } from "./filter-state";
export function MatingFilterControls({
  values,
  errors,
  onChange,
}: {
  values: MatingValues;
  errors: { min?: string; max?: string };
  onChange: (v: MatingUpdate) => void;
}) {
  return (
    <>
      <SpeciesFilter
        value={values.species}
        onChange={(value) => onChange({ field: "species", value })}
      />
      <BreedFilter
        species={values.species}
        selected={values.breeds}
        onChange={(value) => onChange({ field: "breeds", value })}
      />
      <RegionFilter
        selected={values.regions}
        onChange={(value) => onChange({ field: "regions", value })}
      />
      <LocationFilter
        selected={values.locations}
        onChange={(value) => onChange({ field: "locations", value })}
      />
      <fieldset className="mating-gender-filter">
        <legend>Стать</legend>
        {(["MALE", "FEMALE"] as const).map((gender) => (
          <label key={gender}>
            <input
              type="checkbox"
              checked={values.genders.includes(gender)}
              onChange={(e) =>
                onChange({
                  field: "genders",
                  value: e.target.checked
                    ? [...values.genders, gender]
                    : values.genders.filter((g) => g !== gender),
                })
              }
            />
            <span>{gender === "MALE" ? "Самець" : "Самка"}</span>
          </label>
        ))}
      </fieldset>
      <AgeFilter
        value={values.age}
        onChange={(value) => onChange({ field: "age", value })}
      />
      <div className="field">
        <span id="mating-fee-label">Оплата</span>
        <SelectDropdown
          label="Оплата"
          value={values.feeMode ?? "any"}
          options={[
            { value: "any", label: "Будь-яка оплата" },
            { value: "agreement", label: "За домовленістю" },
            { value: "free", label: "Безкоштовно" },
            { value: "fixed", label: "Фіксована оплата" },
          ]}
          onChange={(value) =>
            onChange({
              field: "feeMode",
              value: value === "any" ? undefined : value,
            })
          }
        />
      </div>
      {values.feeMode === "fixed" && (
        <fieldset className="filter-price">
          <legend>Сума, грн</legend>
          <div className="filter-price-fields">
            {(["priceMin", "priceMax"] as const).map((field, i) => {
              const error = i === 0 ? errors.min : errors.max;
              return (
                <div className="field" key={field}>
                  <label htmlFor={"mating-" + field}>
                    {i === 0 ? "Від" : "До"}
                  </label>
                  <input
                    id={"mating-" + field}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={24}
                    value={values[field]}
                    onChange={(e) => onChange({ field, value: e.target.value })}
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                      error ? "mating-" + field + "-error" : "mating-fee-hint"
                    }
                  />
                  {error && (
                    <p
                      className="field-error"
                      id={"mating-" + field + "-error"}
                    >
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="hint" id="mating-fee-hint">
            Лише оголошення з додатною фіксованою оплатою. Межі включні.
          </p>
        </fieldset>
      )}
    </>
  );
}
