import { notFound } from "next/navigation";
import { getFreshSession } from "@/lib/api-auth";
import { hasPermission, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { RoleForm } from "@/components/admin/users/RoleForm";
import { PeopleTabs } from "@/components/admin/users/PeopleTabs";

export default async function NewRolePage() {
  const session = await getFreshSession();
  if (!session || !hasPermission(session.permissions, session.roleName === SUPER_ADMIN_ROLE, "users", "create")) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Add Role</h1>
        <p className="mt-1 text-sm text-muted">Pick exactly what this role is allowed to do.</p>
      </div>
      <PeopleTabs active="roles" />
      <RoleForm mode="create" />
    </div>
  );
}
