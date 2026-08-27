/**
 * Permission model
 * -----------------
 * Every role stores a JSON map of `module -> action[]` in `roles.permissions`.
 * A user's effective permissions are just their role's permissions (no
 * per-user overrides in v1 — keeps the model simple and auditable).
 */

export const PERMISSION_MODULES = [
  "dashboard",
  "portfolio",
  "blog",
  "services",
  "reviews",
  "contacts",
  "newsletter",
  "media",
  "comments",
  "team",
  "users",
  "settings",
  "analytics",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "publish",
  "approve",
  "export",
  "manage",
  "reply",
  "upload",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionMap = Partial<Record<PermissionModule, PermissionAction[]>>;

const ALL_ACTIONS = [...PERMISSION_ACTIONS];

const fullAccess = (): PermissionMap =>
  Object.fromEntries(PERMISSION_MODULES.map((m) => [m, ALL_ACTIONS])) as PermissionMap;

/**
 * System roles seeded on first install. `is_system_role = true` rows cannot
 * be deleted from the Admin UI (only edited), matching PRD §18.
 */
export const SYSTEM_ROLES: { name: string; permissions: PermissionMap }[] = [
  {
    name: "Super Admin",
    permissions: fullAccess(),
  },
  {
    name: "CEO",
    permissions: {
      dashboard: ["view"],
      analytics: ["view"],
      portfolio: ["view", "approve"],
      blog: ["view", "approve"],
      services: ["view"],
      reviews: ["view", "approve"],
      contacts: ["view"],
      newsletter: ["view"],
      media: ["view"],
      comments: ["view", "approve"],
      team: ["view"],
    },
  },
  {
    name: "Admin",
    permissions: {
      dashboard: ["view"],
      analytics: ["view"],
      portfolio: ["view", "create", "edit", "delete"],
      blog: ["view", "create", "edit", "delete", "publish"],
      services: ["view", "create", "edit", "delete"],
      reviews: ["view", "approve", "delete"],
      contacts: ["view", "reply", "delete"],
      newsletter: ["view", "export", "delete"],
      media: ["view", "upload", "delete"],
      comments: ["view", "approve", "delete"],
      team: ["view", "manage"],
    },
  },
  {
    name: "Editor",
    permissions: {
      dashboard: ["view"],
      blog: ["view", "create", "edit", "publish"],
      comments: ["view", "approve"],
      contacts: ["view"],
      media: ["view", "upload"],
    },
  },
  {
    name: "Contributor",
    permissions: {
      dashboard: ["view"],
      blog: ["view", "create"],
      media: ["view", "upload"],
    },
  },
  {
    name: "Author",
    permissions: {
      dashboard: ["view"],
      blog: ["view", "create", "edit", "publish"],
      media: ["view", "upload"],
    },
  },
];

/** Modules that only Super Admin may touch, regardless of what a custom role grants. */
const SUPER_ADMIN_ONLY: PermissionModule[] = ["users", "settings"];

export function hasPermission(
  permissions: PermissionMap,
  isSuperAdmin: boolean,
  module: PermissionModule,
  action: PermissionAction
): boolean {
  if (isSuperAdmin) return true;
  if (SUPER_ADMIN_ONLY.includes(module)) return false;
  return permissions[module]?.includes(action) ?? false;
}
