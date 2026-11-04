import { getBrand } from "@/lib/branding";
import { LoginForm } from "./LoginForm";

// Reads the logo from Settings, so it must not be frozen at build time.
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const { siteName, logoUrl, showText } = await getBrand();
  return <LoginForm brand={{ siteName, logoUrl, showText }} />;
}
