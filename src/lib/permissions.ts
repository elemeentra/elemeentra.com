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

/** Everything except destructive ("delete") and structural ("manage") actions. */
const CONTENT_ACTIONS = ALL_ACTIONS.filter((a) => a !== "delete" && a !== "manage");

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
    // CEO: broad working rights, but one level below Admin — no destructive
    // (delete) or structural (manage) actions. Users/Settings stay Super Admin only.
    name: "CEO",
    permissions: {
      dashboard: ["view"],
      analytics: ["view", "export"],
      portfolio: [...CONTENT_ACTIONS],
      blog: [...CONTENT_ACTIONS],
      services: [...CONTENT_ACTIONS],
      reviews: [...CONTENT_ACTIONS],
      contacts: [...CONTENT_ACTIONS],
      newsletter: [...CONTENT_ACTIONS],
      media: [...CONTENT_ACTIONS],
      comments: [...CONTENT_ACTIONS],
      team: ["view", "create", "edit"],
    },
  },
  {
    // Admin: every action on every content module. Users and Settings are
    // hard-locked to Super Admin in hasPermission() (privilege-escalation guard).
    name: "Admin",
    permissions: {
      dashboard: ["view"],
      analytics: ["view", "export"],
      portfolio: [...ALL_ACTIONS],
      blog: [...ALL_ACTIONS],
      services: [...ALL_ACTIONS],
      reviews: [...ALL_ACTIONS],
      contacts: [...ALL_ACTIONS],
      newsletter: [...ALL_ACTIONS],
      media: [...ALL_ACTIONS],
      comments: [...ALL_ACTIONS],
      team: [...ALL_ACTIONS],
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
export const SUPER_ADMIN_ONLY: PermissionModule[] = ["users", "settings"];

/** The one role that bypasses permission maps. Matched by name in api-auth, so the name is reserved. */
export const SUPER_ADMIN_ROLE = "Super Admin";

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
