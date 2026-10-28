"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { LocationSelector } from "@/entities/location/location-selector";
import type { Location } from "@/entities/location/model";
import { breederProfileFields } from "@/features/breeder/editor/validation";
import { runAdminRequest } from "../moderation/cache";
import { saveManagedBreeder, managementKey } from "../management/api";
import type { ManagedBreeder } from "../management/model";
import { WorkspaceContacts } from "../breeder-workspace/contacts";
export function WizardContacts({
  profile,
  onSaved,
}: {
  profile: ManagedBreeder;
  onSaved: () => Promise<void>;
}) {
  const actor = useSession().data!,
    client = useQueryClient();
  const [website, setWebsite] = useState(profile.website ?? ""),
    [location, setLocation] = useState<Location | null>(
      profile.location
        ? {
            ...profile.location,
            district: null,
            community: null,
            settlementType: null,
            katottgCode: null,
          }
        : null,
    );
  const [baseline, setBaseline] = useState({
    website: profile.website,
    locationId: profile.locationId,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section>
      <fieldset disabled={busy} className="wizard-contact-details">
        <legend>Місце та сайт</legend>
        <div className="field">
          <label htmlFor="wizard-website">Вебсайт — необов’язково</label>
          <input
            id="wizard-website"
            inputMode="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
          {error && <p role="alert">{error}</p>}
        </div>
        <LocationSelector
          label="Місто або село"
          selected={location}
          onSelect={setLocation}
        />
        <p className="muted">
          Електронна адреса акаунта залишається приватною. Для публічного
          зв’язку додайте телефон, месенджери або сайт.
        </p>
      </fieldset>
      <WorkspaceContacts
        onPendingChange={setBusy}
        profile={profile}
        submitLabel="Далі"
        onSaved={onSaved}
        beforeSave={async () => {
          if (
            baseline.website !== profile.website ||
            baseline.locationId !== profile.locationId
          ) {
            setError(
              "Контактні дані змінилися. Перезавантажте сторінку перед повторним збереженням.",
            );
            throw new Error("Revision conflict");
          }
          const checked = breederProfileFields.website.safeParse(website);
          if (!checked.success) {
            setError(checked.error.issues[0].message);
            throw new Error("Invalid website");
          }
          setError("");
          const row = await runAdminRequest(client, actor.id, () =>
            saveManagedBreeder(profile.id, {
              source: profile.source,
              expectedUpdatedAt: profile.updatedAt,
              website: checked.data,
              locationId: location?.id ?? null,
            }),
          );
          setBaseline({ website: row.website, locationId: row.locationId });
          client.setQueryData(
            managementKey(actor.id, "breeder", row.id, row.source),
            row,
          );
          return row;
        }}
      />
    </section>
  );
}
