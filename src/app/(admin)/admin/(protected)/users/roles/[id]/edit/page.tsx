import { notFound } from "next/navigation";
import { query, type RowDataPacket } from "@/lib/db";
import { getFreshSession } from "@/lib/api-auth";
import { hasPermission, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { parsePermissions } from "@/lib/roles";
import { RoleForm } from "@/components/admin/users/RoleForm";
import { PeopleTabs } from "@/components/admin/users/PeopleTabs";

export default async function EditRolePage({ params }: { params: { id: string } }) {
  const session = await getFreshSession();
  if (!session || !hasPermission(session.permissions, session.roleName === SUPER_ADMIN_ROLE, "users", "edit")) {
    notFound();
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const rows = await query<RowDataPacket>("SELECT id, name, is_system_role, permissions FROM roles WHERE id = ? LIMIT 1", [id]);
  const role = rows[0];
  // Super Admin is immutable — treat its edit URL as not found.
  if (!role || role.name === SUPER_ADMIN_ROLE) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Edit Role</h1>
        <p className="mt-1 text-sm text-muted">{role.name}</p>
      </div>
      <PeopleTabs active="roles" />
      <RoleForm
        mode="edit"
        roleId={role.id}
        initialName={role.name}
        initialPermissions={parsePermissions(role.permissions)}
        isSystemRole={Boolean(role.is_system_role)}
      />
    </div>
  );
}
