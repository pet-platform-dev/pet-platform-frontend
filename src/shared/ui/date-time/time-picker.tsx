"use client";
import { useId } from "react";
import { SelectDropdown } from "../select-dropdown";
import { timeHours, timeMinutes } from "./calendar";
export function TimePicker({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId(),
    [hour, minute] = value ? value.split(":") : ["", ""];
  return (
    <div className="care-time">
      <span id={id} className="care-time-label">
        {label}
      </span>
      <div className="care-time-fields" role="group" aria-labelledby={id}>
        <SelectDropdown
          label={label + ": години"}
          value={hour}
          options={[{ value: "", label: "—" }, ...timeHours]}
          onChange={(v) => onChange(v + ":" + minute)}
          disabled={disabled}
        />
        <span aria-hidden="true">:</span>
        <SelectDropdown
          label={label + ": хвилини"}
          value={minute}
          options={[{ value: "", label: "—" }, ...timeMinutes]}
          onChange={(v) => onChange(hour + ":" + v)}
          disabled={disabled}
        />
      </div>
      <output
        className="care-time-value"
        aria-label={label + " у форматі HH:mm"}
      >
        {/^\d{2}:\d{2}$/.test(value) ? value : "Оберіть час"}
      </output>
    </div>
  );
}
