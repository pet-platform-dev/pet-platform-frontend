import { z } from "zod";
import { notFound } from "next/navigation";
import { HistoryPage } from "@/features/pet-care/history/history-page";
export const metadata = {
  title: "Історія догляду — Лапа",
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
  return <HistoryPage id={id} add={add === "1"} />;
}
