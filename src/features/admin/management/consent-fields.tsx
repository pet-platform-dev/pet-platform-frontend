import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { sourceConsentLabels } from "./model";
export type ConsentValues = {
  consentConfirmed: boolean;
  consentAt: string;
  consentScope: string;
  consentSource: string;
  sourceReference: string;
};
export const emptyConsent: ConsentValues = {
  consentConfirmed: false,
  consentAt: "",
  consentScope: "",
  consentSource: "OWNER_REQUEST",
  sourceReference: "",
};
export function ConsentFields({
  value,
  onChange,
  errors,
}: {
  value: ConsentValues;
  onChange: (next: ConsentValues) => void;
  errors: Record<string, string>;
}) {
  return (
    <fieldset>
      <legend>Дозвіл власника на приватну підготовку</legend>
      <p className="muted">
        Публічна інформація з іншого сайту не є згодою. Не додавайте паролі,
        приватне листування чи зайві контактні дані.
      </p>
      <label className="account-actions">
        <input
          type="checkbox"
          checked={value.consentConfirmed}
          onChange={(event) =>
            onChange({ ...value, consentConfirmed: event.target.checked })
          }
        />
        Маю дозвіл власника на підготовку цієї чернетки
      </label>
      {errors.consentConfirmed && (
        <p role="alert" className="field-error">
          {errors.consentConfirmed}
        </p>
      )}
      <div className="field">
        <span>Джерело дозволу</span>
        <SelectDropdown
          label="Джерело дозволу"
          value={value.consentSource}
          options={Object.entries(sourceConsentLabels).map(
            ([value, label]) => ({ value, label }),
          )}
          onChange={(consentSource) => onChange({ ...value, consentSource })}
        />
      </div>
      {(
        [
          [
            "consentAt",
            "Фактична дата й час згоди",
            "datetime-local",
            undefined,
          ],
          ["consentScope", "Обсяг дозволу на підготовку", "text", 1000],
          ["sourceReference", "Довідка про джерело згоди", "text", 200],
        ] as const
      ).map(([key, label, type, maxLength]) => (
        <div className="field" key={key}>
          <label htmlFor={key}>{label}</label>
          <input
            id={key}
            value={value[key]}
            type={type}
            maxLength={maxLength}
            onChange={(event) =>
              onChange({ ...value, [key]: event.target.value })
            }
            aria-invalid={Boolean(errors[key])}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
          />
          {errors[key] && (
            <p id={`${key}-error`} role="alert" className="field-error">
              {errors[key]}
            </p>
          )}
        </div>
      ))}
    </fieldset>
  );
}
