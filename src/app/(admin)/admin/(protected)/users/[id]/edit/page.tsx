import { notFound } from "next/navigation";
import { query, type RowDataPacket } from "@/lib/db";
import { getFreshSession } from "@/lib/api-auth";
import { hasPermission, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { paragraphsToText } from "@/lib/sanitize";
import { UserForm, type UserFormData } from "@/components/admin/users/UserForm";
import { PeopleTabs } from "@/components/admin/users/PeopleTabs";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const session = await getFreshSession();
  if (!session || !hasPermission(session.permissions, session.roleName === SUPER_ADMIN_ROLE, "users", "edit")) {
    notFound();
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  // Password hash is deliberately not selected.
  const rows = await query<RowDataPacket>(
    `SELECT id, name, email, role_id, custom_service, profile_photo, bio, status FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  const user = rows[0];
  if (!user) notFound();

  const links = await query<RowDataPacket>(
    `SELECT platform_name, platform_url, icon_type, custom_icon_url
     FROM user_social_links WHERE user_id = ? ORDER BY display_order ASC, id ASC`,
    [id]
  );

  const initialData: Partial<UserFormData> = {
    name: user.name,
    email: user.email,
    role_id: user.role_id,
    status: user.status,
    custom_service: user.custom_service ?? "",
    profile_photo: user.profile_photo,
    bio: paragraphsToText(user.bio),
    social_links: links.map((l) => ({
      platform_name: l.platform_name,
      platform_url: l.platform_url,
      icon_type: l.icon_type,
      custom_icon_url: l.custom_icon_url,
    })),
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Edit User</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>
      <PeopleTabs active="users" />
      <UserForm mode="edit" userId={user.id} isSelf={user.id === session.userId} initialData={initialData} />
    </div>
  );
}
