import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";
import { verifySessionToken } from "@/lib/jwt";
import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar } from "@/components/admin/Topbar";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = getEnv();
  const token = cookies().get(env.COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // The middleware already redirects unauthenticated requests before this
  // layout ever renders. This check is a defense-in-depth backstop in case
  // middleware config or matcher ever changes.
  if (!session) {
    redirect("/admin/login");
  }

  const isSuperAdmin = session.roleName === "Super Admin";

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar permissions={session.permissions} isSuperAdmin={isSuperAdmin} />
      <div className="flex flex-1 flex-col">
        <Topbar name={session.name} role={session.roleName} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
