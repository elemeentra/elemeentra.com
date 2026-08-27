/**
 * Applies database/schema.sql to the configured database.
 *
 *   npm run db:migrate
 *
 * Safe to re-run — every CREATE TABLE uses IF NOT EXISTS.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

// Next.js convention: .env.local overrides .env. Load both so this script
// behaves the same way `next dev` / `next build` would.
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

async function main() {
  const {
    DB_HOST = "127.0.0.1",
    DB_PORT = "3306",
    DB_USER = "root",
    DB_PASSWORD = "",
    DB_NAME,
  } = process.env;

  if (!DB_NAME) {
    console.error("❌ DB_NAME is not set. Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }

  const schemaPath = path.join(process.cwd(), "database", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf-8");

  console.log(`→ Connecting to ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} ...`);
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.changeUser({ database: DB_NAME });

  console.log("→ Applying schema.sql ...");
  await connection.query(sql);

  console.log("✅ Schema applied successfully.");
  await connection.end();
}

main().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
