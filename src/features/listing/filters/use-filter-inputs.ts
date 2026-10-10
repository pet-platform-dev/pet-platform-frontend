"use client";
import { useEffect, useState } from "react";
import { priceErrors } from "./price-validation";
import type { Filters } from "./model";
type Inputs = Pick<Filters, "q" | "priceMin" | "priceMax">;
export function useFilterInputs(
  base: string,
  applied: Inputs,
  commit: (values: Inputs, mode: "push" | "replace") => Inputs,
) {
  const [edit, setEdit] = useState({
    base,
    values: applied,
    mode: "replace" as "push" | "replace",
  });
  if (edit.base !== base) setEdit({ base, values: applied, mode: "replace" });
  const values = edit.base === base ? edit.values : applied,
    errors = priceErrors(values.priceMin, values.priceMax),
    invalid = Boolean(errors.min || errors.max);
  const pending =
    values.q !== applied.q ||
    values.priceMin !== applied.priceMin ||
    values.priceMax !== applied.priceMax;
  useEffect(() => {
    if (!pending || invalid || edit.base !== base) return;
    const timer = setTimeout(
      () =>
        setEdit({ base, values: commit(values, edit.mode), mode: edit.mode }),
      350,
    );
    return () => clearTimeout(timer);
  }, [pending, invalid, edit, base, values, commit]);
  function update(field: keyof Inputs, value: string) {
    const next = { ...values, [field]: value };
    setEdit({
      base,
      values: next,
      mode:
        next.priceMin !== applied.priceMin || next.priceMax !== applied.priceMax
          ? "push"
          : "replace",
    });
  }
  function reset(values: Inputs) {
    setEdit({ base, values, mode: "replace" });
  }
  return { values, errors, invalid, pending, update, reset };
}
