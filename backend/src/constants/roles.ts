export enum UserRole {
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
  ORGANIZATION_ADMIN = "ORGANIZATION_ADMIN",
  MANAGER = "MANAGER",
  STAFF = "STAFF"
}

export const ALL_ROLES = Object.values(UserRole);
