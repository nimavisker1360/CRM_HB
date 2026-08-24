export const USER_ROLES = ["ADMIN", "MANAGER", "AGENT"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["INVITED", "ACTIVE", "SUSPENDED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export function isAdmin(role?: string) {
  return role === "ADMIN";
}

export function canManageTeam(role?: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canManageSettings(role?: string) {
  return role === "ADMIN";
}
