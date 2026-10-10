"use client";
import type { ComponentProps } from "react";
import { LargeReferenceSelect } from "./large-reference-select";
type Props<T extends { id: string }> = Omit<
  ComponentProps<typeof LargeReferenceSelect<T>>,
  "selected" | "selectedIds" | "onSelect"
> & {
  selected: T[];
  onChange: (items: T[]) => void;
};
export function ReferenceMultiSelect<T extends { id: string }>({
  selected,
  onChange,
  ...props
}: Props<T>) {
  return (
    <div className="reference-multi-select">
      <LargeReferenceSelect<T>
        {...props}
        selected={null}
        selectedIds={selected.map((item) => item.id)}
        onSelect={(item) => {
          if (
            item &&
            !selected.some((value) => value.id === item.id) &&
            selected.length < 50
          )
            onChange([...selected, item]);
        }}
      />
      {selected.length > 0 && (
        <ul className="reference-chips" aria-label={`Обрані: ${props.label}`}>
          {selected.map((item) => (
            <li key={item.id}>
              <span>
                <strong>{props.itemLabel(item)}</strong>
                {props.itemContext && <small>{props.itemContext(item)}</small>}
              </span>
              <button
                type="button"
                aria-label={`Видалити: ${props.itemLabel(item)}`}
                onClick={() =>
                  onChange(selected.filter((value) => value.id !== item.id))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
