import { notFound } from "next/navigation";
import { getFreshSession } from "@/lib/api-auth";
import { getEnv } from "@/lib/env";
import { hasPermission, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { loadSettingsGroup } from "@/lib/settings";
import { SeoSettingsForm } from "@/components/admin/settings/SeoSettingsForm";

export default async function SeoSettingsPage() {
  const session = await getFreshSession();
  if (!session || !hasPermission(session.permissions, session.roleName === SUPER_ADMIN_ROLE, "settings", "view")) {
    notFound();
  }

  const initial = await loadSettingsGroup("seo");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">SEO Settings</h1>
        <p className="mt-1 text-sm text-muted">Default titles, descriptions and social image for the whole site.</p>
      </div>
      <SeoSettingsForm initial={initial} siteUrl={getEnv().NEXT_PUBLIC_SITE_URL} />
    </div>
  );
}
