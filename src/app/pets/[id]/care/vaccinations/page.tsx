import { z } from "zod";
import { notFound } from "next/navigation";
import { RecordsPage } from "@/features/pet-care/health-records/records-page";
export const metadata = {
  title: "Вакцинації — Лапа",
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
  return <RecordsPage id={id} kind="vaccinations" add={add === "1"} />;
}
