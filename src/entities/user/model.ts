import type { AccountType } from "./account-type";
export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  accountType: AccountType;
  role: "USER" | "BREEDER" | "MODERATOR" | "ADMIN";
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  createdAt: string;
};
