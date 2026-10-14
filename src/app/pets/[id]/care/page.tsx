import { z } from "zod";
import { notFound } from "next/navigation";
import { PetCarePage } from "@/features/pet-care/pet-care-page";
export const metadata = {
  title: "Догляд за твариною — Лапа",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <PetCarePage id={id} />;
}
