export const breederAnimalsPath = "/profile/breeder/animals";

/** Only known owner-management destinations; persisted in the editor URL. */
export function petEditorReturn(value: unknown): string {
  return value === breederAnimalsPath ? breederAnimalsPath : "/pets";
}

export function breederPetEditorHref(id?: string): string {
  const path = id ? "/pets/" + encodeURIComponent(id) + "/edit" : "/pets/new";
  return path + "?" + new URLSearchParams({ returnTo: breederAnimalsPath });
}
