import { notFound } from "next/navigation";
import { getFreshSession } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import { TeamForm } from "@/components/admin/team/TeamForm";

export default async function NewTeamMemberPage() {
  const session = await getFreshSession();
  if (!session || !hasPermission(session.permissions, session.roleName === "Super Admin", "team", "create")) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Add Team Member</h1>
        <p className="mt-1 text-sm text-muted">Add someone to your public team section.</p>
      </div>
      <TeamForm mode="create" />
    </div>
  );
}
