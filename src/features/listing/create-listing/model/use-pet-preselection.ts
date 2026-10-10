import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Pet } from "@/entities/pet/model";
import type { CreateListingFormInput } from "./schema";
export function usePetPreselection(
  id: string | undefined,
  pets: Pet[],
  loaded: boolean,
  form: UseFormReturn<CreateListingFormInput>,
) {
  useEffect(() => {
    if (
      !id ||
      !loaded ||
      pets.some((pet) => pet.id === id) ||
      form.getValues("petId") !== id
    )
      return;
    form.setValue("petId", "");
    form.setError("petId", {
      message: "Не вдалося вибрати тварину. Оберіть власну тварину зі списку.",
    });
  }, [id, pets, loaded, form]);
}
