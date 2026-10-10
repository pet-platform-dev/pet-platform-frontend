export const accountTypes = ["SELLER", "BREEDER"] as const;
export type AccountType = (typeof accountTypes)[number];
export const accountTypePresentation = {
  SELLER: {
    label: "Власник тварини",
    description: "Для продажу, прилаштування та керування власними тваринами.",
  },
  BREEDER: {
    label: "Заводчик",
    description:
      "Для професійних заводчиків і розплідників з розширеним профілем.",
  },
} satisfies Record<AccountType, { label: string; description: string }>;
export const isBreeder = (type: AccountType) => type === "BREEDER";
export const nextAccountType = (type: AccountType): AccountType =>
  isBreeder(type) ? "SELLER" : "BREEDER";
