import type { Filters } from "./model";
export function PriceFilter({
  filters,
  errors,
  onChange,
}: {
  filters: Filters;
  errors: { min?: string; max?: string };
  onChange: (field: "priceMin" | "priceMax", value: string) => void;
}) {
  const disabled = filters.type === "FREE" || filters.type === "ADOPTION";
  return (
    <fieldset className="filter-price" aria-describedby="filter-price-hint">
      <legend>Ціна, грн</legend>
      <div className="filter-price-fields">
        {(["Min", "Max"] as const).map((suffix, index) => {
          const field = suffix === "Min" ? "priceMin" : "priceMax",
            error = index === 0 ? errors.min : errors.max;
          return (
            <div className="field" key={field}>
              <label htmlFor={`filter-${field}`}>
                {index === 0 ? "Від" : "До"}
              </label>
              <input
                id={`filter-${field}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                maxLength={24}
                placeholder="₴"
                value={filters[field]}
                disabled={disabled}
                onChange={(event) => onChange(field, event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `filter-${field}-error` : undefined}
              />
              {error && (
                <p className="field-error" id={`filter-${field}-error`}>
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="hint" id="filter-price-hint">
        {disabled
          ? "Для безкоштовних оголошень і прилаштування ціна не застосовується."
          : "Діапазон ціни показує лише оголошення про продаж."}
      </p>
    </fieldset>
  );
}
