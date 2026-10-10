import type { User } from "@/entities/user/model";
import type { AccountType } from "@/entities/user/account-type";
import { authenticatedRequest } from "@/shared/api/client";
export function updateAccountType(accountType: AccountType) {
  return authenticatedRequest<User>("/account/type", {
    method: "PATCH",
    body: JSON.stringify({ accountType }),
  });
}
