import { numericInput } from "@/shared/lib/numeric-input";
import type { BreederValues } from "./validation";
export function BreederTextFields({
  values,
  onChange,
  errors,
  disabled,
}: {
  values: BreederValues;
  onChange: (key: keyof BreederValues, value: string) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  return (
    <>
      {(
        [
          ["kennelName", "Назва розплідника"],
          ["description", "Про розплідник"],
          ["startedYear", "Рік початку діяльності"],
          ["website", "Вебсайт"],
        ] as const
      ).map(([key, label]) => {
        const id = "breeder-" + key;
        const props = {
          id,
          value: values[key],
          disabled,
          "aria-invalid": Boolean(errors[key]),
          "aria-describedby": id + "-hint",
          onChange: (
            event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) =>
            onChange(
              key,
              key === "startedYear"
                ? numericInput(event.target.value)
                : event.target.value,
            ),
        };
        return (
          <div className="field" key={key}>
            <label htmlFor={id}>
              {label}
              {key !== "kennelName" && (
                <span className="muted"> — Необов’язково</span>
              )}
            </label>
            {key === "description" ? (
              <textarea {...props} rows={5} />
            ) : (
              <input
                {...props}
                required={key === "kennelName"}
                inputMode={
                  key === "startedYear"
                    ? "numeric"
                    : key === "website"
                      ? "url"
                      : "text"
                }
                autoComplete="off"
              />
            )}
            <p
              id={id + "-hint"}
              className={errors[key] ? "field-error" : "muted"}
            >
              {errors[key] ??
                (key === "website"
                  ? "Адреса з http:// або https://"
                  : key === "startedYear"
                    ? "Від 1900 до поточного року"
                    : key === "description"
                      ? "Звичайний текст, до 5000 символів"
                      : "До 160 символів")}
            </p>
          </div>
        );
      })}
    </>
  );
}
