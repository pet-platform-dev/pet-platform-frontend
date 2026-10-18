import type { Metadata } from "next";
import { BreederDirectory } from "@/features/breeders/breeder-directory";
import { parseDirectoryQuery } from "@/entities/breeder/directory-query";
export const metadata: Metadata = {
  title: "Розплідники тварин — Лапа",
  description:
    "Публічні профілі розплідників та їхні тварини на платформі Лапа.",
};
export default async function BreedersPage({
  searchParams,
}: PageProps<"/breeders">) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const part of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, part);
  }
  return <BreederDirectory initial={parseDirectoryQuery(params)} />;
}
