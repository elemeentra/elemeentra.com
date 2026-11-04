import "server-only";
import { z } from "zod";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  SUPER_ADMIN_ONLY,
  SUPER_ADMIN_ROLE,
} from "@/lib/permissions";

const assignableModules = PERMISSION_MODULES.filter((m) => !SUPER_ADMIN_ONLY.includes(m));

/**
 * Permission map for a custom/system role. Rejects unknown modules and the
 * Super-Admin-only ones (users, settings — hasPermission would ignore them
 * anyway), then normalizes: de-duplicated actions, empty modules dropped, and
 * "view" implied whenever any other action is granted.
 */
export const rolePermissionsSchema = z
  .record(z.string(), z.array(z.enum(PERMISSION_ACTIONS)))
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (!(assignableModules as readonly string[]).includes(key)) {
        ctx.addIssue({ code: "custom", message: `"${key}" can't be assigned to a role.` });
      }
    }
  })
  .transform((value) => {
    const out: Record<string, string[]> = {};
    for (const [module, actions] of Object.entries(value)) {
      const set = new Set<string>(actions);
      if (set.size === 0) continue;
      set.add("view");
      out[module] = PERMISSION_ACTIONS.filter((a) => set.has(a));
    }
    return out;
  });

export const roleSchema = z.object({
  name: z.string().trim().min(2, "Role name must be at least 2 characters").max(50),
  permissions: rolePermissionsSchema,
});

export function isReservedRoleName(name: string): boolean {
  return name.trim().toLowerCase() === SUPER_ADMIN_ROLE.toLowerCase();
}

export function parsePermissions(value: string | Record<string, string[]>): Record<string, string[]> {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return {};
  }
}

export { assignableModules };
