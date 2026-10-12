"use client";
import { useId } from "react";
import type { FeeMode } from "./model";
export function FeeChoice({
  mode,
  value,
  onMode,
  onValue,
  error,
}: {
  mode: FeeMode;
  value: string;
  onMode: (mode: FeeMode) => void;
  onValue: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <fieldset className="mating-fee">
      <legend>Оплата</legend>
      <div className="mating-fee-options">
        {(
          [
            ["agreement", "За домовленістю"],
            ["free", "Безкоштовно"],
            ["fixed", "Фіксована оплата"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="radio"
              name={id + "-fee"}
              value={key}
              checked={mode === key}
              onChange={() => onMode(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <p className="form-hint">
        Умови ви обговорюєте з іншими власниками. Оплата на платформі не
        здійснюється.
      </p>
      {mode === "fixed" && (
        <div className="field">
          <label htmlFor={id + "-amount"}>Сума, грн</label>
          <input
            id={id + "-amount"}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(event) => onValue(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={id + "-fee-hint"}
            placeholder="Наприклад, 1500,00"
          />
          <p
            id={id + "-fee-hint"}
            className={error ? "field-error" : "form-hint"}
          >
            {error ||
              "UAH · до двох десяткових знаків. Сума 0 означає безкоштовно."}
          </p>
        </div>
      )}
    </fieldset>
  );
}
