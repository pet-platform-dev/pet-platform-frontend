import { z } from "zod";

const verifiedContact = z.strictObject({
  status: z.literal("VERIFIED"),
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
  const result = verifiedContact.safeParse(config);
  return result.success ? result.data.email : null;
}

export function PrivacyContact({ config }: { config: unknown }) {
  const email = privacyContactEmail(config);
  return email ? (
    <p>
      Перевірена адреса для звернень:{" "}
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
