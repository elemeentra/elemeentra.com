import "server-only";
import { z } from "zod";
import { query, type RowDataPacket, type PoolConnection } from "@/lib/db";
import { ApiError } from "@/lib/api-auth";
import { optionalImageUrl, optionalText, requiredHttpUrl } from "@/lib/zod-helpers";

/**
 * bcrypt only hashes the first 72 bytes, so longer passwords would silently
 * share a hash prefix — cap at 72 and require a letter + a digit.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Password needs at least one letter and one number");

const socialLinkSchema = z.object({
  platform_name: z.string().trim().min(1, "Platform name is required").max(100),
  platform_url: requiredHttpUrl(255),
  icon_type: z.enum(["preset", "custom"]).default("preset"),
  custom_icon_url: optionalImageUrl(255),
});

const userBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(150),
  role_id: z.number().int().positive(),
  status: z.enum(["active", "inactive"]).default("active"),
  custom_service: optionalText(150),
  profile_photo: optionalImageUrl(255),
  bio: optionalText(1000),
  social_links: z.array(socialLinkSchema).max(12).default([]),
});

export const createUserSchema = userBaseSchema.extend({ password: passwordSchema });

/** On edit the password is optional — empty means "keep the current one". */
export const updateUserSchema = userBaseSchema.extend({
  password: z.union([z.literal(""), passwordSchema]).optional(),
});

export const quickEditUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role_id: z.number().int().positive().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  unlock: z.literal(true).optional(),
});

export type SocialLinkInput = z.infer<typeof socialLinkSchema>;

export async function assertRoleExists(roleId: number): Promise<void> {
  const rows = await query<RowDataPacket>("SELECT id FROM roles WHERE id = ? LIMIT 1", [roleId]);
  if (rows.length === 0) throw new ApiError(400, "The selected role no longer exists.");
}

export async function assertEmailAvailable(email: string, exceptUserId?: number): Promise<void> {
  const rows = await query<RowDataPacket>(
    "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1",
    [email, exceptUserId ?? 0]
  );
  if (rows.length > 0) throw new ApiError(409, "A user with this email already exists.");
}

/** Replaces all of a user's social links (inside the caller's transaction). */
export async function replaceSocialLinks(
  conn: PoolConnection,
  userId: number,
  links: SocialLinkInput[]
): Promise<void> {
  await conn.execute("DELETE FROM user_social_links WHERE user_id = ?", [userId]);
  for (let i = 0; i < links.length; i++) {
    const l = links[i];
    await conn.execute(
      `INSERT INTO user_social_links (user_id, platform_name, platform_url, icon_type, custom_icon_url, display_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        l.platform_name,
        l.platform_url,
        l.icon_type,
        l.icon_type === "custom" ? l.custom_icon_url : null,
        i + 1,
      ]
    );
  }
}

/** Unique-index race (two admins creating the same email at once) → the same friendly 409. */
export function rethrowDuplicateEmail(err: unknown): never {
  if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
    throw new ApiError(409, "A user with this email already exists.");
  }
  throw err;
}
