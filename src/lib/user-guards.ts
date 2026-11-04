import "server-only";
import { query, type RowDataPacket } from "@/lib/db";
import { ApiError } from "@/lib/api-auth";
import { placeholders } from "@/lib/api-utils";
import { SUPER_ADMIN_ROLE } from "@/lib/permissions";

interface CountRow extends RowDataPacket {
  c: number;
}

/**
 * Throws if the change would leave the CMS without an active Super Admin.
 * Call with the ids of users about to be deleted, deactivated or demoted;
 * it's a no-op when none of them is currently an active Super Admin.
 */
export async function assertSuperAdminRemains(affectedIds: number[]): Promise<void> {
  if (affectedIds.length === 0) return;
  const ph = placeholders(affectedIds.length);

  const affected = await query<CountRow>(
    `SELECT COUNT(*) AS c FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.name = ? AND u.status = 'active' AND u.id IN (${ph})`,
    [SUPER_ADMIN_ROLE, ...affectedIds]
  );
  if ((affected[0]?.c ?? 0) === 0) return;

  const others = await query<CountRow>(
    `SELECT COUNT(*) AS c FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.name = ? AND u.status = 'active' AND u.id NOT IN (${ph})`,
    [SUPER_ADMIN_ROLE, ...affectedIds]
  );
  if ((others[0]?.c ?? 0) === 0) {
    throw new ApiError(400, "At least one active Super Admin must remain.");
  }
}

/** Blocks destructive changes to your own account (delete / deactivate). */
export function assertNotSelf(sessionUserId: number, targetIds: number[], action: string): void {
  if (targetIds.includes(sessionUserId)) {
    throw new ApiError(400, `You can't ${action} your own account.`);
  }
}
