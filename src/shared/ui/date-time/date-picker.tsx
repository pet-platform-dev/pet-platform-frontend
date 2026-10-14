"use client";
import { useEffect, useId, useRef, useState } from "react";
import { SelectDropdown } from "../select-dropdown";
import { useSelectDismiss } from "../use-select-dismiss";
import {
  calendarParts,
  calendarDate,
  calendarMonth,
  calendarLabel,
  dateButtonLabel,
  moveCalendar,
  monthCells,
  calendarMonths,
  calendarWeekdays,
} from "./calendar";
export function DatePicker({
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
  const today = () => {
    const d = new Date();
    return calendarDate(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const root = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId(),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(value || today());
  const { year, month } = calendarParts(active),
    cells = monthCells(active);
  useSelectDismiss(root, open, () => setOpen(false));
  useEffect(() => {
    if (open) {
      panel.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`)
        ?.focus({ preventScroll: true });
      panel.current?.scrollIntoView({ block: "nearest" });
    }
  }, [open, active]);
  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  function shift(months: number) {
    const d = calendarParts(calendarDate(year, month + months, 1));
    setActive(calendarMonth(active, d.year, d.month));
  }
  return (
    <div
      className="care-date"
      ref={root}
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget))
          setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open && !e.defaultPrevented) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <label id={id + "label"}>{label}</label>
      <button
        type="button"
        ref={trigger}
        className="care-date-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => {
          if (open) close();
          else {
            setActive(value || today());
            setOpen(true);
          }
        }}
      >
        <span>{dateButtonLabel(value)}</span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 2v6m8-6v6" />
        </svg>
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={"Календар: " + label}
          className="care-calendar"
        >
          <div className="care-calendar-nav">
            <button
              type="button"
              aria-label="Попередній місяць"
              onClick={() => shift(-1)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div>
              <SelectDropdown
                label="Місяць"
                value={String(month)}
                options={calendarMonths.map((label, i) => ({
                  value: String(i),
                  label,
                }))}
                onChange={(v) =>
                  setActive(calendarMonth(active, year, Number(v)))
                }
              />
            </div>
            <div>
              <SelectDropdown
                label="Рік"
                value={String(year)}
                options={Array.from(
                  { length: Math.max(2100, year) - Math.min(1900, year) + 1 },
                  (_, i) => {
                    const v = String(Math.min(1900, year) + i);
                    return { value: v, label: v };
                  },
                )}
                onChange={(v) =>
                  setActive(calendarMonth(active, Number(v), month))
                }
              />
            </div>
            <button
              type="button"
              aria-label="Наступний місяць"
              onClick={() => shift(1)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
          <p className="care-calendar-announcement" aria-live="polite">
            {calendarMonths[month]} {year}
          </p>
          <div
            role="grid"
            aria-label={calendarMonths[month] + " " + year}
            onKeyDown={(e) => {
              if (
                !(e.target instanceof HTMLButtonElement) ||
                !e.target.dataset.day
              )
                return;
              const key = e.key,
                day = calendarParts(active);
              if (
                [
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Home",
                  "End",
                  "PageUp",
                  "PageDown",
                ].includes(key)
              ) {
                e.preventDefault();
                if (key === "PageUp" || key === "PageDown") {
                  const delta = key === "PageUp" ? -1 : 1;
                  const d = calendarParts(
                    calendarDate(
                      year,
                      month + delta * (e.shiftKey ? 12 : 1),
                      1,
                    ),
                  );
                  setActive(calendarMonth(active, d.year, d.month));
                } else {
                  const weekday =
                    (new Date(active + "T12:00Z").getUTCDay() + 6) % 7;
                  const delta =
                    key === "ArrowLeft"
                      ? -1
                      : key === "ArrowRight"
                        ? 1
                        : key === "ArrowUp"
                          ? -7
                          : key === "ArrowDown"
                            ? 7
                            : key === "Home"
                              ? -weekday
                              : 6 - weekday;
                  setActive(
                    moveCalendar(
                      calendarDate(day.year, day.month, day.day),
                      delta,
                    ),
                  );
                }
              }
            }}
          >
            <div role="row" className="care-calendar-row">
              {calendarWeekdays.map((d) => (
                <span role="columnheader" key={d}>
                  {d}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, row) => (
              <div role="row" className="care-calendar-row" key={row}>
                {cells.slice(row * 7, row * 7 + 7).map((date, i) =>
                  date ? (
                    <span
                      role="gridcell"
                      key={date}
                      aria-selected={value === date}
                    >
                      <button
                        type="button"
                        data-day={date}
                        aria-pressed={value === date}
                        tabIndex={active === date ? 0 : -1}
                        aria-label={calendarLabel(date)}
                        aria-current={date === today() ? "date" : undefined}
                        className={
                          (value === date ? "selected " : "") +
                          (date === today() ? "today" : "")
                        }
                        onClick={() => {
                          onChange(date);
                          close();
                        }}
                      >
                        {calendarParts(date).day}
                      </button>
                    </span>
                  ) : (
                    <span role="gridcell" key={"blank" + i} />
                  ),
                )}
              </div>
            ))}
          </div>
          <div className="care-calendar-footer">
            <button
              type="button"
              onClick={() => {
                const date = today();
                onChange(date);
                close();
              }}
            >
              Сьогодні
            </button>
            <button type="button" onClick={close}>
              Закрити календар
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
