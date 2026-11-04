import { notFound } from "next/navigation";
import { getFreshSession } from "@/lib/api-auth";
import { hasPermission, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { UserForm } from "@/components/admin/users/UserForm";
import { PeopleTabs } from "@/components/admin/users/PeopleTabs";

export default async function NewUserPage() {
  const session = await getFreshSession();
  if (!session || !hasPermission(session.permissions, session.roleName === SUPER_ADMIN_ROLE, "users", "create")) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Add User</h1>
        <p className="mt-1 text-sm text-muted">Create a CMS account and choose what it can access.</p>
      </div>
      <PeopleTabs active="users" />
      <UserForm mode="create" />
    </div>
  );
}
