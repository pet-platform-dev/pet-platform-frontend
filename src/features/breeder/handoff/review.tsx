"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, sessionKey } from "@/features/auth/session-provider";
import {
  authenticatedRequest,
  currentSessionGeneration,
} from "@/shared/api/client";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { ImageGallery } from "@/shared/ui/image-gallery";
import type { Handoff } from "./contracts";
export function HandoffReview({
  handoff,
  onAccepted,
}: {
  handoff: Handoff;
  onAccepted: () => void;
}) {
  const client = useQueryClient(),
    user = useSession().data!;
  const [animals, setAnimals] = useState(
      handoff.items.map(({ draft: d }) => ({
        draftId: d.id,
        name: "",
        gender: d.gender,
        birthDate: d.birthDate?.slice(0, 10) ?? "",
      })),
    ),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  return (
    <form
      className="dashboard-card auth-form"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current || !confirmed) return;
        lock.current = true;
        setBusy(true);
        setMessage("");
        const generation = currentSessionGeneration();
        try {
          await authenticatedRequest(`/breeder-handoffs/${handoff.id}/accept`, {
            method: "POST",
            body: JSON.stringify({
              confirmAnimals: true,
              animals: animals.map((a) => ({
                ...a,
                name: a.name.trim() || null,
                birthDate: a.birthDate || null,
              })),
            }),
          });
          if (
            generation !== currentSessionGeneration() ||
            client.getQueryData<{ id: string }>(sessionKey)?.id !== user.id
          )
            return;
          setMessage(
            "Прийнято. Тварини й оголошення створені як приватні чернетки. Перевірте їх перед поданням на модерацію.",
          );
          onAccepted();
          for (const queryKey of [
            ["my-listings"],
            ["my-pets"],
            ["breeder-handoffs", user.id],
          ])
            void client.invalidateQueries({ queryKey });
        } catch {
          if (generation === currentSessionGeneration())
            setMessage(
              "Не вдалося прийняти. Передача могла змінитися або завершитися. Оновіть дані та повторіть.",
            );
        } finally {
          lock.current = false;
          if (generation === currentSessionGeneration()) setBusy(false);
        }
      }}
    >
      <h3>{handoff.breederDraft.kennelName ?? "Підготовлені оголошення"}</h3>
      <p>
        До {new Date(handoff.expiresAt).toLocaleDateString("uk-UA")}. Перевірте
        кожну тварину. Прийняття не публікує оголошення.
      </p>
      <fieldset disabled={busy}>
        <legend>Підтвердження тварин</legend>
        {handoff.items.map(({ draft: d }, i) => (
          <section key={d.id}>
            <h4>{d.title}</h4>
            <p>
              {[
                d.species?.name,
                d.breed?.nameUk ?? d.breed?.name,
                d.location
                  ? [d.location.city, d.location.region].join(", ")
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p>{d.description}</p>
            <p>{d.price ? `${d.price} грн` : "Ціна за домовленістю"}</p>
            {d.images.length > 0 && (
              <ImageGallery
                heading={d.title}
                images={d.images.map((m) => ({ ...m, thumbnailUrl: m.url }))}
              />
            )}
            <div className="field">
              <label htmlFor={`name-${d.id}`}>Ім’я — необов’язково</label>
              <input
                id={`name-${d.id}`}
                maxLength={150}
                value={animals[i].name}
                onChange={(e) =>
                  setAnimals((old) =>
                    old.map((a, j) =>
                      j === i ? { ...a, name: e.target.value } : a,
                    ),
                  )
                }
              />
            </div>
            <SelectDropdown
              label={`Стать: ${d.title}`}
              value={animals[i].gender}
              options={[
                { value: "UNKNOWN", label: "Не вказано" },
                { value: "MALE", label: "Самець" },
                { value: "FEMALE", label: "Самка" },
              ]}
              onChange={(v) =>
                setAnimals((old) =>
                  old.map((a, j) =>
                    j === i ? { ...a, gender: v as typeof a.gender } : a,
                  ),
                )
              }
            />
            <div className="field">
              <label htmlFor={`birth-${d.id}`}>
                Дата народження — необов’язково
              </label>
              <input
                type="date"
                id={`birth-${d.id}`}
                value={animals[i].birthDate}
                onChange={(e) =>
                  setAnimals((old) =>
                    old.map((a, j) =>
                      j === i ? { ...a, birthDate: e.target.value } : a,
                    ),
                  )
                }
              />
            </div>
          </section>
        ))}
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          Дані цих тварин перевірено. Приймаю їхні приватні профілі та чернетки
          оголошень.
        </label>
      </fieldset>
      <button
        className="button primary"
        disabled={!confirmed || busy}
        type="submit"
      >
        {busy ? "Приймаємо…" : "Прийняти вибрані оголошення"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
