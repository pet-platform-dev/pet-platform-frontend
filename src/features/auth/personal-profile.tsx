"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { User } from "@/entities/user/model";
import { authenticatedRequest } from "@/shared/api/client";
import { sessionKey, notifySessionChange } from "./session-provider";
import { refreshPersonalIdentity } from "./personal-profile-cache";
export const personalIdentitySchema = z.strictObject({
  firstName: z
    .string()
    .trim()
    .min(1, "Введіть ім’я")
    .max(100, "Не більше 100 символів"),
  lastName: z
    .string()
    .trim()
    .min(1, "Введіть прізвище")
    .max(100, "Не більше 100 символів"),
});
export function PersonalProfile({ user }: { user: User }) {
  const client = useQueryClient(),
    lock = useRef(false);
  const [editing, setEditing] = useState(false),
    [pending, setPending] = useState(false),
    [firstName, setFirstName] = useState(user.firstName),
    [lastName, setLastName] = useState(user.lastName ?? ""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState("");
  return (
    <section
      className="account-section"
      aria-labelledby="personal-profile-title"
    >
      <h2 id="personal-profile-title">Особисті дані</h2>
      {!editing ? (
        <>
          <p>
            {user.firstName} {user.lastName}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setFirstName(user.firstName);
              setLastName(user.lastName ?? "");
              setMessage("");
              setErrors({});
              setEditing(true);
            }}
          >
            Редагувати особисті дані
          </button>
        </>
      ) : (
        <form
          noValidate
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current) return;
            const result = personalIdentitySchema.safeParse({
              firstName,
              lastName,
            });
            if (!result.success) {
              setErrors(
                Object.fromEntries(
                  result.error.issues.map((issue) => [
                    String(issue.path[0]),
                    issue.message,
                  ]),
                ),
              );
              return;
            }
            lock.current = true;
            setPending(true);
            setErrors({});
            setMessage("");
            try {
              const updated = await authenticatedRequest<User>(
                "/account/profile",
                { method: "PATCH", body: JSON.stringify(result.data) },
              );
              await client.cancelQueries({ queryKey: sessionKey });
              if (client.getQueryData<User>(sessionKey)?.id !== user.id) return;
              client.setQueryData(sessionKey, updated);
              await refreshPersonalIdentity(client, user.id);
              notifySessionChange("profile");
              setFirstName(updated.firstName);
              setLastName(updated.lastName ?? "");
              setEditing(false);
              setMessage("Особисті дані збережено.");
            } catch {
              setErrors({
                form: "Не вдалося зберегти особисті дані. Спробуйте ще раз.",
              });
            } finally {
              lock.current = false;
              setPending(false);
            }
          }}
        >
          <fieldset disabled={pending}>
            {(
              [
                ["firstName", "Ім’я", firstName, setFirstName],
                ["lastName", "Прізвище", lastName, setLastName],
              ] as const
            ).map(([name, label, value, setValue]) => (
              <div className="field" key={name}>
                <label htmlFor={"personal-" + name}>{label}</label>
                <input
                  id={"personal-" + name}
                  autoComplete={
                    name === "firstName" ? "given-name" : "family-name"
                  }
                  maxLength={100}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={
                    errors[name] ? "personal-" + name + "-error" : undefined
                  }
                />
                {errors[name] && (
                  <p className="field-error" id={"personal-" + name + "-error"}>
                    {errors[name]}
                  </p>
                )}
              </div>
            ))}
            {errors.form && (
              <p role="alert" className="field-error">
                {errors.form}
              </p>
            )}
            <div className="form-actions">
              <button className="button primary" type="submit">
                {pending ? "Зберігаємо…" : "Зберегти зміни"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(false)}
              >
                Скасувати
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
