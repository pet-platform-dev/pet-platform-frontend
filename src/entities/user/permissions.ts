export const hasAdminAccess = (role: unknown) =>
  role === "ADMIN" || role === "SUPER_ADMIN";
export const hasRoleManagement = (role: unknown) => role === "SUPER_ADMIN";
