"use client";
import {
  useController,
  type FieldValues,
  type FieldPath,
  type UseFormReturn,
} from "react-hook-form";
import { SelectDropdown } from "./select-dropdown";
export function FormSelect<
  T extends FieldValues,
  U extends FieldValues | undefined = T,
>({
  form,
  name,
  label,
  id,
  options,
  disabled,
  onChange,
}: {
  form: UseFormReturn<T, undefined, U>;
  name: FieldPath<T>;
  label: string;
  id?: string;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const { field, fieldState } = useController({ control: form.control, name });
  return (
    <SelectDropdown
      onFocusRef={field.ref}
      onBlur={field.onBlur}
      label={label}
      value={String(field.value ?? "")}
      options={options}
      controlId={id ?? name}
      disabled={disabled}
      invalid={Boolean(fieldState.error)}
      describedBy={fieldState.error ? `${name}-error` : undefined}
      onChange={(value) => {
        field.onChange(value);
        onChange?.(value);
      }}
    />
  );
}
