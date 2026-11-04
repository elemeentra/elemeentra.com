import { notFound } from "next/navigation";
import { getFreshSession } from "@/lib/api-auth";
import { hasPermission, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { loadSettingsGroup } from "@/lib/settings";
import { GeneralSettingsForm } from "@/components/admin/settings/GeneralSettingsForm";

export default async function SettingsPage() {
  const session = await getFreshSession();
  if (!session || !hasPermission(session.permissions, session.roleName === SUPER_ADMIN_ROLE, "settings", "view")) {
    notFound();
  }

  const initial = await loadSettingsGroup("general");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted">Site identity, contact details and branding.</p>
      </div>
      <GeneralSettingsForm initial={initial} />
    </div>
  );
}
