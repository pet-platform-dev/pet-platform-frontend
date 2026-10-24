"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  currentSessionGeneration,
  authenticatedRequest,
} from "@/shared/api/client";
import { ownBreederSchema } from "@/entities/breeder/owner-api";
import { updateBreederCache } from "./cache";
export function ClaimPublication({ userId }: { userId: string }) {
  const client = useQueryClient(),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    busy = useRef(false);
  async function publish() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const generation = currentSessionGeneration();
    try {
      const profile = ownBreederSchema.parse(
        await authenticatedRequest("/breeders/me/publish", {
          method: "POST",
          body: JSON.stringify({ confirmPublication: true }),
        }),
      );
      if (generation === currentSessionGeneration()) {
        await updateBreederCache(client, userId, profile);
      }
    } catch {
      if (generation === currentSessionGeneration())
        setMessage("Не вдалося опублікувати профіль. Спробуйте ще раз.");
    } finally {
      busy.current = false;
      if (generation === currentSessionGeneration()) setPending(false);
    }
  }
  return (
    <section className="status-panel">
      <h2>Отриманий профіль приватний</h2>
      <p>
        Перевірте й збережіть інформацію перед окремою публікацією. Оголошення
        не публікуються цією дією.
      </p>
      <button
        className="button secondary"
        disabled={pending}
        onClick={() => void publish()}
      >
        Опублікувати перевірений мною профіль
      </button>
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
