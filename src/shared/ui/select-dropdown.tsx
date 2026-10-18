"use client";
import { useMotionPresence } from "@/shared/hooks/use-motion-presence";
import { useId, useRef, useState, useEffect } from "react";
import { useSelectDismiss } from "./use-select-dismiss";
import { useDropdownOverlay } from "./use-dropdown-overlay";
export function SelectDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  controlId,
  describedBy,
  invalid,
  onFocusRef,
  onBlur,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  controlId?: string;
  describedBy?: string;
  invalid?: boolean;
  onFocusRef?: (node: HTMLButtonElement | null) => void;
  onBlur?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    id = useId();
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const present = useMotionPresence(open);
  const menu = useRef<HTMLUListElement>(null);
  const overlay = useDropdownOverlay(present, root, trigger, menu, 205, 300);
  const selected = Math.max(
    0,
    options.findIndex((item) => item.value === value),
  );
  useSelectDismiss(root, open, () => setOpen(false));
  useEffect(() => {
    if (open)
      root.current
        ?.querySelectorAll('[role="option"]')
        [active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
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
      data-open={present || undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        id={controlId}
        disabled={disabled || !options.length}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        ref={(node) => {
          trigger.current = node;
          onFocusRef?.(node);
        }}
        onBlur={onBlur}
        data-value={value}
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
        <span>{options[selected]?.label ?? "Оберіть значення"}</span>
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
      {present && (
        <ul
          ref={menu}
          style={overlay}
          id={id}
          className="select-dropdown-options motion-surface"
          data-motion={open ? "open" : "closed"}
          aria-hidden={!open}
          inert={!open}
          role="listbox"
          aria-label={label}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              data-value={option.value}
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
