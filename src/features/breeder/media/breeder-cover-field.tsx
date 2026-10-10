import type { ComponentProps } from "react";
import { BreederImageField } from "./breeder-image-field";
export function BreederCoverField(
  props: Omit<ComponentProps<typeof BreederImageField>, "kind">,
) {
  return <BreederImageField {...props} kind="cover" />;
}
