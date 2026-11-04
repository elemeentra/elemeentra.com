import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";
import { getFreshSessionCached } from "@/lib/api-auth";
import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar } from "@/components/admin/Topbar";
import { AdminBoot } from "@/components/admin/AdminBoot";
import { getBrand } from "@/lib/branding";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = getEnv();
  const token = cookies().get(env.COOKIE_NAME)?.value;

  let session = null;
  try {
    session = token ? await getFreshSessionCached() : null;
  } catch (err: unknown) {
    // DB unreachable (ETIMEDOUT, ECONNREFUSED, etc.) — show a proper error
    // page instead of an unhandled runtime crash.
    const isConnErr =
      err instanceof Error &&
      (err.message.includes("ETIMEDOUT") ||
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("ENOTFOUND") ||
        err.message.includes("connect"));

    if (isConnErr) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-8">
          <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="mb-2 text-xl font-bold text-foreground">Database Unreachable</h1>
            <p className="mb-4 text-sm text-muted">
              The admin panel cannot connect to the database right now. This usually means the
              database server is offline, or remote connections are blocked by the hosting
              firewall.
            </p>
            <p className="text-xs text-muted">
              <strong>For Hostinger:</strong> Go to hPanel → Databases → Remote MySQL → add your
              current IP address to allow connections.
            </p>
          </div>
        </div>
      );
    }
    throw err; // re-throw unexpected errors
  }

  // The middleware already redirects unauthenticated requests before this
  // layout ever renders. This check is a defense-in-depth backstop in case
  // middleware config or matcher ever changes.
  if (!session) {
    redirect("/admin/login");
  }

  const isSuperAdmin = session.roleName === "Super Admin";
  const brand = await getBrand(); // cached — no DB hit on most requests

  return (
    <div className="admin-shell">
      <AdminBoot />
      <Sidebar
        permissions={session.permissions}
        isSuperAdmin={isSuperAdmin}
        brand={{ siteName: brand.siteName, logoUrl: brand.logoUrl, showText: brand.showText }}
      />
      <div className="adm-main">
        <Topbar
          name={session.name}
          role={session.roleName}
          photo={session.profilePhoto ?? null}
          userId={session.userId ?? null}
          permissions={session.permissions}
          isSuperAdmin={isSuperAdmin}
        />
        {/* No overflow here: an overflow-* ancestor would break position:sticky (editor toolbar). */}
        <main className="adm-content">{children}</main>
      </div>
    </div>
  );
}
