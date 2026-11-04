import "server-only";
import { z } from "zod";
import { query, type RowDataPacket } from "@/lib/db";
import { ApiError } from "@/lib/api-auth";
import { optionalHttpUrl, optionalImageUrl, optionalText } from "@/lib/zod-helpers";

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  role: optionalText(100),
  photo_url: optionalImageUrl(255),
  bio: optionalText(1000),
  linkedin_url: optionalHttpUrl(255),
  user_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  display_order: z.number().int().min(0).max(100000).optional(),
});

/** A linked user must exist — otherwise the FK error would surface as a vague 500. */
export async function assertUserExists(userId: number | null): Promise<void> {
  if (userId === null) return;
  const rows = await query<RowDataPacket>("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
  if (rows.length === 0) throw new ApiError(400, "The selected user no longer exists.");
}
