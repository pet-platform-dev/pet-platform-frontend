import type { Pet } from "@/entities/pet/model";
import {
  listingHeading,
  listingGender,
} from "@/entities/listing/model/presentation";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import { ApiError } from "@/shared/api/client";
export function petOptionLabel(pet: Pet) {
  return [
    listingHeading(pet),
    pet.name?.trim(),
    formatPetAge(pet.birthDate),
    listingGender(pet.gender),
  ]
    .filter(Boolean)
    .join(" · ");
}
export function createListingError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409)
      return "Для цієї тварини вже існує незавершене оголошення.";
    if (error.status === 404) return "Не вдалося використати цю тварину.";
    if (error.status === 401) return "Сесію завершено. Увійдіть знову.";
    if (error.status === 403) return "Оновіть сторінку та спробуйте знову.";
    if (
      error.status === 400 &&
      error.message === "Оберіть доступне місце розташування"
    )
      return "Обране місце недоступне.";
  }
  return "Не вдалося створити оголошення. Спробуйте ще раз.";
}
