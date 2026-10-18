import type { Metadata } from "next";
import { BreederDirectory } from "@/features/breeders/breeder-directory";
import { directoryPage } from "@/entities/breeder/directory";
export const metadata: Metadata = {
  title: "Розплідники тварин — Лапа",
  description:
    "Публічні профілі розплідників та їхні тварини на платформі Лапа.",
};
export default async function BreedersPage({
  searchParams,
}: PageProps<"/breeders">) {
  return <BreederDirectory page={directoryPage((await searchParams).page)} />;
}
