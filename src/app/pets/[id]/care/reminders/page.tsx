import { z } from "zod";
import { notFound } from "next/navigation";
import { RemindersPage } from "@/features/pet-care/reminders/reminders-page";
export const metadata = {
  title: "Нагадування — Лапа",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { add } = await searchParams;
  return <RemindersPage id={id} add={add === "1"} />;
}
