import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { OwnBreeder } from "@/entities/breeder/owner-api";
import type { Location } from "@/entities/location/model";
import {
  recoveredForm,
  useFormRecovery,
} from "@/features/listing/form-recovery";
import { emptyValues, type BreederValues } from "./validation";
import type { SelectedBreed } from "./breeder-breed-selector";
type Draft = {
  input: BreederValues;
  location: Location | null;
  breeds: SelectedBreed[];
};
export function useBreederFormState(
  userId: string,
  profile: OwnBreeder | null,
) {
  const recoveryKey = userId + ":breeder";
  const [draft] = useState(() => recoveredForm<Draft>(recoveryKey));
  const form = useForm<BreederValues>({
    defaultValues:
      draft?.input ??
      (profile
        ? {
            kennelName: profile.kennelName,
            description: profile.description ?? "",
            website: profile.website ?? "",
            startedYear: profile.startedYear?.toString() ?? "",
          }
        : emptyValues),
  });
  const values = { ...emptyValues, ...useWatch({ control: form.control }) };
  const [location, setLocation] = useState<Location | null>(() =>
    draft
      ? draft.location
      : profile?.location
        ? {
            ...profile.location,
            district: null,
            community: null,
            settlementType: null,
            katottgCode: null,
          }
        : null,
  );
  const [breeds, setBreeds] = useState<SelectedBreed[]>(
    () => draft?.breeds ?? profile?.breeds ?? [],
  );
  useFormRecovery(recoveryKey, form, { location, breeds });
  return {
    values,
    setValue: (key: keyof BreederValues, value: string) =>
      form.setValue(key, value, { shouldDirty: true }),
    location,
    setLocation,
    breeds,
    setBreeds,
    recoveryKey,
  };
}
