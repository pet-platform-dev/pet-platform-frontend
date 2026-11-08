"use client";
import { useId } from "react";
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { NumericInput } from "@/shared/ui/numeric-input";
// Controlled subscriptions keep form.reset synchronized with the DOM under the
// React Compiler, including cached field JSX and overlapping query notifications.
export function WorkspaceTextField<T extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  multiline = false,
  decimal = false,
  maxLength,
  placeholder,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type?: string;
  multiline?: boolean;
  decimal?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  const id = useId(),
    { field, fieldState } = useController({ control, name });
  const props = {
    id,
    name: field.name,
    ref: field.ref,
    value: String(field.value ?? ""),
    onBlur: field.onBlur,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) =>
      field.onChange(
        decimal ? event.target.value.replace(",", ".") : event.target.value,
      ),
    maxLength,
    placeholder,
    "aria-invalid": Boolean(fieldState.error),
    "aria-describedby": fieldState.error ? id + "-error" : undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...props} rows={5} />
      ) : decimal ? (
        <NumericInput {...props} inputMode="decimal" />
      ) : (
        <input {...props} type={type} />
      )}
      {fieldState.error && (
        <p id={id + "-error"} role="alert">
          {fieldState.error.message}
        </p>
      )}
    </div>
  );
}
