import type { Metadata } from "next";
import { parseMatingUrl } from "@/features/mating/catalog/query";
import { MatingCatalog } from "@/features/mating/catalog/catalog";
export const metadata: Metadata = {
  title: "В’язка — Лапа",
  description:
    "Знайдіть пару для своєї тварини серед оголошень власників і розплідників.",
  robots: { index: true, follow: true },
};
export default async function MatingPage({
  searchParams,
}: PageProps<"/mating">) {
  return <MatingCatalog query={parseMatingUrl(await searchParams)} />;
}
