import { z } from "zod";

const suppliedContact = z.strictObject({
  status: z.enum(["PENDING_VERIFICATION", "VERIFIED"]),
  email: z
    .string()
    .email()
    .max(254)
    .refine((email) => {
      const domain = (email.split("@")[1] ?? "").toLowerCase();
      return (
        domain.includes(".") &&
        !/(^|\.)(example\.(com|org|net)|example|invalid|test|localhost|local)$/.test(
          domain,
        )
      );
    }),
});

// Versioned build configuration, never an environment/personal-account fallback.
export function privacyContactEmail(config: unknown): string | null {
  const result = suppliedContact.safeParse(config);
  return result.success && result.data.status === "VERIFIED"
    ? result.data.email
    : null;
}

export function PrivacyContact({ config }: { config: unknown }) {
  const supplied = suppliedContact.safeParse(config);
  if (supplied.success && supplied.data.status === "PENDING_VERIFICATION")
    return (
      <p>
        Адреса, надана оператором: {supplied.data.email}. Володіння скринькою,
        доставка листів і регулярний розгляд звернень ще не підтверджені. Поки
        що ця чернетка не пропонує перевіреного каналу приймання запитів.
      </p>
    );
  const email = privacyContactEmail(config);
  return email ? (
    <p>
      Адреса для звернень:{" "}
      <a href={`mailto:${encodeURIComponent(email)}`}>{email}</a>. Надсилання
      листа не означає автоматичне виконання запиту.
    </p>
  ) : (
    <p>
      Контакт для звернень ще не налаштовано. Ця чернетка поки не пропонує
      дієвого каналу для запитів щодо персональних даних.
    </p>
  );
}
