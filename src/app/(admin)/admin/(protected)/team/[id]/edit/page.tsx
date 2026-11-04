import { notFound } from "next/navigation";
import { query, type RowDataPacket } from "@/lib/db";
import { getFreshSession } from "@/lib/api-auth";
import { hasPermission } from "@/lib/permissions";
import { paragraphsToText } from "@/lib/sanitize";
import { TeamForm, type TeamFormData } from "@/components/admin/team/TeamForm";

interface MemberRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  name: string;
  role: string | null;
  photo_url: string | null;
  bio: string | null;
  linkedin_url: string | null;
  display_order: number;
}

export default async function EditTeamMemberPage({ params }: { params: { id: string } }) {
  const session = await getFreshSession();
  if (!session || !hasPermission(session.permissions, session.roleName === "Super Admin", "team", "edit")) {
    notFound();
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const rows = await query<MemberRow>("SELECT * FROM team_members WHERE id = ? LIMIT 1", [id]);
  const member = rows[0];
  if (!member) notFound();

  const initialData: Partial<TeamFormData> = {
    name: member.name,
    role: member.role ?? "",
    photo_url: member.photo_url,
    bio: paragraphsToText(member.bio),
    linkedin_url: member.linkedin_url ?? "",
    user_id: member.user_id,
    display_order: member.display_order,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Edit Team Member</h1>
        <p className="mt-1 text-sm text-muted">{member.name}</p>
      </div>
      <TeamForm mode="edit" memberId={member.id} initialData={initialData} />
    </div>
  );
}
