"use client";
import type { ComponentProps } from "react";
import { numericInput } from "@/shared/lib/numeric-input";
export function NumericInput({
  inputMode = "numeric",
  onChange,
  ...props
}: ComponentProps<"input">) {
  return (
    <input
      {...props}
      type="text"
      inputMode={inputMode}
      onChange={(event) => {
        event.target.value = numericInput(
          event.target.value,
          inputMode === "decimal",
        );
        onChange?.(event);
      }}
    />
  );
}
