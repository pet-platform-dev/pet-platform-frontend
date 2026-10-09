"use client";
import { useRef, useState } from "react";
import { useForm, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { getProfile, saveProfile } from "@/entities/seller/api";
import {
  profileInputSchema,
  type ProfileInput,
  type Seller,
} from "@/entities/seller/model";
import { LocationSelector } from "@/entities/location/location-selector";
import type { Location } from "@/entities/location/model";
import { ApiError } from "@/shared/api/client";
function ProfileForm({ seller }: { seller: Seller }) {
  const client = useQueryClient(),
    submitting = useRef(false);
  const [location, setLocation] = useState<Location | null>(
    seller.location
      ? {
          ...seller.location,
          district: null,
          community: null,
          settlementType: null,
          katottgCode: null,
        }
      : null,
  );
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: {
      phone: seller.phone ?? "",
      telegram: seller.telegram ?? "",
      viber: seller.viber ?? "",
      whatsapp: seller.whatsapp ?? "",
    },
  });
  const mutation = useMutation({
    retry: false,
    mutationFn: (input: ProfileInput) =>
      saveProfile(input, location?.id ?? null),
    onSuccess: async (updated) => {
      client.setQueryData(["profile", seller.id], updated);
      client.setQueryData(["seller", seller.id], updated);
      await client.invalidateQueries({
        predicate: (query) =>
          [
            "listing",
            "listings",
            "owned-listing",
            "my-listings",
            "seller-listings",
          ].includes(String(query.queryKey[0])),
      });
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const { errors } = useFormState({ control: form.control });
  return (
    <form
      className="auth-form"
      onSubmit={(event) =>
        void form.handleSubmit((input) => {
          if (submitting.current) return;
          submitting.current = true;
          mutation.mutate(input);
        })(event)
      }
    >
      <h1>Публічний профіль продавця</h1>
      <p className="listing-seller-name">{seller.displayName}</p>
      <p className="muted">
        Ім’я та прізвище з вашого акаунта показуються публічно.
      </p>
      <p>
        Ці контакти можуть бути показані у ваших активних оголошеннях та
        публічному профілі. Усі контакти необов’язкові. Реєстраційна електронна
        адреса залишається приватною.
      </p>
      {(
        [
          ["phone", "Телефон"],
          ["telegram", "Telegram"],
          ["viber", "Viber"],
          ["whatsapp", "WhatsApp"],
        ] as const
      ).map(([key, label]) => (
        <div key={key} className="field">
          <label htmlFor={`profile-${key}`}>
            {label}
            <span className="muted"> — Необов’язково</span>
          </label>
          <input
            id={`profile-${key}`}
            autoComplete={key === "phone" ? "tel" : "off"}
            inputMode={
              ["phone", "viber", "whatsapp"].includes(key) ? "tel" : "text"
            }
            aria-invalid={Boolean(errors[key])}
            aria-describedby={`profile-${key}-hint`}
            {...form.register(key)}
          />
          <p
            id={`profile-${key}-hint`}
            className={errors[key] ? "field-error" : "muted"}
          >
            {errors[key]?.message ??
              (key === "telegram" ? "@username" : "+380501234567")}
          </p>
        </div>
      ))}
      <LocationSelector selected={location} onSelect={setLocation} />
      {mutation.isError && (
        <p role="alert">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : "Не вдалося зберегти профіль. Спробуйте ще раз."}
        </p>
      )}
      {mutation.isSuccess && <p role="status">Публічний профіль збережено.</p>}
      <button className="button primary" disabled={mutation.isPending}>
        {mutation.isPending ? "Зберігаємо…" : "Зберегти профіль"}
      </button>
    </form>
  );
}
function OwnProfile() {
  const session = useSession();
  const query = useQuery({
    queryKey: ["profile", session.data?.id],
    queryFn: ({ signal }) => getProfile(signal),
  });
  if (query.isPending) return <p role="status">Завантажуємо профіль…</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>Не вдалося завантажити профіль.</p>
        <button
          className="button secondary"
          onClick={() => void query.refetch()}
        >
          Спробувати ще раз
        </button>
      </div>
    );
  return <ProfileForm key={query.data.id} seller={query.data} />;
}
export function ProfileEditor() {
  return (
    <RequireSession>
      <OwnProfile />
    </RequireSession>
  );
}
