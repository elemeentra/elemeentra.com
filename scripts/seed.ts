/**
 * Seeds the 6 system roles (PRD §18) and creates the first Super Admin.
 *
 *   npm run db:seed -- --email you@elemeentra.com --password "Str0ng!Pass" --name "Abu Bakar"
 *
 * Re-running is safe: roles are upserted by name, and the super admin step
 * is skipped if that email already exists.
 */
import path from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { SYSTEM_ROLES } from "../src/lib/permissions";

// Next.js convention: .env.local overrides .env. Load both so this script
// behaves the same way `next dev` / `next build` would.
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const { DB_HOST = "127.0.0.1", DB_PORT = "3306", DB_USER = "root", DB_PASSWORD = "", DB_NAME } =
    process.env;

  if (!DB_NAME) {
    console.error("❌ DB_NAME is not set. Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }

  const email = getArg("email");
  const password = getArg("password");
  const name = getArg("name") ?? "Abu Bakar";

  if (!email || !password) {
    console.error(
      '❌ Usage: npm run db:seed -- --email you@elemeentra.com --password "Str0ng!Pass" --name "Abu Bakar"'
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("❌ Password must be at least 8 characters.");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  console.log("→ Seeding system roles ...");
  for (const role of SYSTEM_ROLES) {
    const [existing] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT id FROM roles WHERE name = ? LIMIT 1",
      [role.name]
    );
    if (existing.length > 0) {
      await connection.query("UPDATE roles SET permissions = ?, is_system_role = TRUE WHERE name = ?", [
        JSON.stringify(role.permissions),
        role.name,
      ]);
      console.log(`  ↻ updated: ${role.name}`);
    } else {
      await connection.query(
        "INSERT INTO roles (name, is_system_role, permissions) VALUES (?, TRUE, ?)",
        [role.name, JSON.stringify(role.permissions)]
      );
      console.log(`  ✓ created: ${role.name}`);
    }
  }

  const [superAdminRole] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1"
  );
  const superAdminRoleId = superAdminRole[0]?.id;

  const [existingUser] = await connection.query<mysql.RowDataPacket[]>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  if (existingUser.length > 0) {
    console.log(`ℹ️  User ${email} already exists — skipping user creation.`);
  } else {
    const hashed = await bcrypt.hash(password, 12);
    await connection.query(
      "INSERT INTO users (name, email, password, role_id, status) VALUES (?, ?, ?, ?, 'active')",
      [name, email, hashed, superAdminRoleId]
    );
    console.log(`  ✓ Super Admin created: ${email}`);
  }

  console.log("✅ Seed complete.");
  await connection.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
