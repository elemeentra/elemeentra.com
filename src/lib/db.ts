import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { getEnv } from "./env";

// In dev, Next.js hot-reloads modules on every save. Without this guard we'd
// leak a new connection pool per reload until MySQL refuses connections.
declare global {
  // eslint-disable-next-line no-var
  var __elemeentraPool: Pool | undefined;
}

function createPool(): Pool {
  const env = getEnv();
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    maxIdle: env.DB_CONNECTION_LIMIT,
    idleTimeout: 60_000,
    queueLimit: 0,
    dateStrings: true,
  });
}

export function getPool(): Pool {
  if (process.env.NODE_ENV === "production") {
    return createPool();
  }
  if (!global.__elemeentraPool) {
    global.__elemeentraPool = createPool();
  }
  return global.__elemeentraPool;
}

/**
 * Run a parameterized SELECT. Always use `?` placeholders — never string-
 * concatenate user input into SQL (OWASP A03 — Injection).
 *
 *   const rows = await query<{ id: number; email: string }>(
 *     "SELECT id, email FROM users WHERE email = ?",
 *     [email]
 *   );
 */
export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: ReadonlyArray<unknown> = []
): Promise<T[]> {
  const [rows] = await getPool().query<T[]>(sql, params as unknown[]);
  return rows;
}

/**
 * Run a parameterized INSERT / UPDATE / DELETE and get back the
 * ResultSetHeader (insertId, affectedRows, etc.).
 */
export async function execute(
  sql: string,
  params: ReadonlyArray<unknown> = []
): Promise<ResultSetHeader> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await getPool().execute<ResultSetHeader>(sql, params as any[]);
  return result;
}

export type { RowDataPacket, ResultSetHeader };
