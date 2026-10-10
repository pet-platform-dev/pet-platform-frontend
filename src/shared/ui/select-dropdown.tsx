"use client";
import { useId, useRef, useState } from "react";
import { useSelectDismiss } from "./use-select-dismiss";
export function SelectDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    id = useId();
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const selected = Math.max(
    0,
    options.findIndex((item) => item.value === value),
  );
  useSelectDismiss(root, open, () => setOpen(false));
  function show() {
    setActive(selected);
    setOpen(true);
  }
  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  return (
    <div
      ref={root}
      className="select-dropdown"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className="select-dropdown-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(active);
            else show();
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
            else
              setActive(
                (index) =>
                  (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    options.length) %
                  options.length,
              );
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setOpen(true);
            setActive(event.key === "Home" ? 0 : options.length - 1);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === "Tab") setOpen(false);
        }}
      >
        <span>{options[selected].label}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          id={id}
          className="select-dropdown-options"
          role="listbox"
          aria-label={label}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={value === option.value}
              className={active === index ? "is-highlighted" : undefined}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {value === option.value && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m5 12 4 4L19 6" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
