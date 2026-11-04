/**
 * Populates test DB and writes JWT tokens to /tmp/tokens.json.
 * npx tsx --require /tmp/so-stub.cjs scripts/seed-tokens.ts
 */
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "3306";
process.env.DB_USER = "root";
process.env.DB_PASSWORD = "";
process.env.DB_NAME = "elemeentra_test";
process.env.DB_SOCKET_PATH = "/tmp/mysql.sock";
process.env.JWT_SECRET = "sandbox-test-secret-0123456789abcdef0123456789";
process.env.ADMIN_PATH = "bakars-elemeentra";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
// NODE_ENV is read-only in strict TS — set via CLI if needed

import mysql from "mysql2/promise";
import fs from "node:fs";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { signSessionToken } from "@/lib/jwt";

async function main() {
  const c = await mysql.createConnection({
    socketPath: "/tmp/mysql.sock",
    user: "root",
    password: "",
    database: "elemeentra_test",
  });

  await c.query("SET FOREIGN_KEY_CHECKS=0");
  for (const t of ["users", "roles", "settings", "media"]) await c.query(`TRUNCATE \`${t}\``);
  await c.query("SET FOREIGN_KEY_CHECKS=1");

  const roleIds: Record<string, number> = {};
  for (const r of SYSTEM_ROLES) {
    const [res]: any = await c.execute(
      "INSERT INTO roles (name, is_system_role, permissions) VALUES (?, 1, ?)",
      [r.name, JSON.stringify(r.permissions)]
    );
    roleIds[r.name] = res.insertId;
  }

  const mk = async (name: string, email: string, role: string, status = "active") => {
    const [res]: any = await c.execute(
      "INSERT INTO users (name, email, password, role_id, status) VALUES (?, ?, ?, ?, ?)",
      [name, email, "hashed_pw", roleIds[role], status]
    );
    const perms = SYSTEM_ROLES.find((r) => r.name === role)!.permissions as Record<string, string[]>;
    return signSessionToken({ userId: res.insertId, email, name, roleId: roleIds[role], roleName: role, permissions: perms });
  };

  const tokens = {
    superadmin: await mk("Super Admin", "super@t.test", "Super Admin"),
    admin:      await mk("Admin User",  "admin@t.test", "Admin"),
    ceo:        await mk("CEO User",    "ceo@t.test",   "CEO"),
    editor:     await mk("Editor",      "editor@t.test","Editor"),
    inactive:   await mk("Inactive SA", "gone@t.test",  "Super Admin", "inactive"),
  };

  fs.writeFileSync("/tmp/tokens.json", JSON.stringify(tokens, null, 2));
  console.log("✓ roles:", Object.keys(roleIds).join(", "));
  console.log("✓ tokens:", Object.keys(tokens).join(", "));
  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
