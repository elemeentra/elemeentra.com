import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import { getEnv } from "./env";

// In dev, Next.js hot-reloads modules on every save. Without this guard we'd
// leak a new connection pool per reload until MySQL refuses connections.
declare global {
  // eslint-disable-next-line no-var
  var __elemeentraPool: Pool | undefined;
}

function createPool(): Pool {
  const env = getEnv();
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    maxIdle: env.DB_CONNECTION_LIMIT,
    // Was 60s: after a minute without clicks every pooled socket was closed, so
    // the next click paid a full reconnect to the remote DB (TCP + auth + SET
    // time_zone, several slow round-trips). Keep sockets for 10 min and ping them
    // (see startKeepAlive) so they never go cold.
    idleTimeout: 600_000,
    queueLimit: 0,
    dateStrings: true,
    // Remote DBs (Hostinger) silently drop idle sockets; without keep-alive the
    // first click after a pause pays a full reconnect (several round-trips).
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    connectTimeout: 10_000,
    timezone: "Z",
  });
  // Run every connection in UTC so NOW()/TIMESTAMP columns/our own UTC
  // date strings all agree regardless of the database server's time zone.
  pool.pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
}

export function getPool(): Pool {
  // Use a global singleton in ALL environments so Next.js hot-reload in dev
  // and serverless-style cold starts in production never leak extra pools.
  if (!global.__elemeentraPool) {
    global.__elemeentraPool = createPool();
    startKeepAlive(global.__elemeentraPool);
  }
  return global.__elemeentraPool;
}

const WARM_CONNECTIONS = 3;
const PING_EVERY_MS = 25_000;

/**
 * Opens a few connections immediately (so the first real request doesn't pay
 * the connect cost) and pings them on an interval so remote-DB firewalls /
 * proxies never drop them as idle.
 */
function startKeepAlive(pool: Pool): void {
  const ping = () =>
    Promise.all(Array.from({ length: WARM_CONNECTIONS }, () => pool.query("SELECT 1"))).catch(() => undefined);
  void ping();
  const timer = setInterval(ping, PING_EVERY_MS);
  timer.unref?.();
}

// Queries slower than this are logged so a slow page can be traced to its SQL.
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 400);

function logIfSlow(sql: string, startedAt: number): void {
  const ms = Date.now() - startedAt;
  if (ms >= SLOW_QUERY_MS) {
    console.warn(`[db] slow query ${ms}ms: ${sql.replace(/\s+/g, " ").trim().slice(0, 160)}`);
  }
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
  const startedAt = Date.now();
  const [rows] = await getPool().query<T[]>(sql, params as unknown[]);
  logIfSlow(sql, startedAt);
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
  const startedAt = Date.now();
  // pool.query (client-side escaping, same `?` safety) instead of pool.execute:
  // execute() is a server-side prepared statement = an extra network round-trip
  // per new statement per connection, which is costly against a remote database.
  const [result] = await getPool().query<ResultSetHeader>(sql, params as unknown[]);
  logIfSlow(sql, startedAt);
  return result;
}

/**
 * Runs `fn` inside a transaction on a dedicated connection: commits if it
 * resolves, rolls back (and rethrows) if it throws.
 */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}

export type { RowDataPacket, ResultSetHeader, PoolConnection };
