import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { signSessionToken } from "@/lib/jwt";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getEnv } from "@/lib/env";

const LOGIN_ATTEMPT_LIMIT = 5;
const LOCKOUT_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().email().max(150),
  password: z.string().min(1).max(200),
});

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password: string;
  status: "active" | "inactive";
  failed_login_attempts: number;
  locked_until: string | null;
  role_id: number;
  role_name: string;
  permissions: string; // JSON column comes back as string via mysql2
}

async function logAuthEvent(
  event: "login_success" | "login_failed" | "lockout",
  opts: { userId?: number; email?: string; ip: string; userAgent: string | null }
) {
  await execute(
    `INSERT INTO auth_logs (user_id, email_attempted, event, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    [opts.userId ?? null, opts.email ?? null, event, opts.ip, opts.userAgent]
  );
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const ip = getClientIp(request.headers);
  const userAgent = request.headers.get("user-agent");

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password format." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const rows = await query<UserRow>(
    `SELECT u.id, u.name, u.email, u.password, u.status,
            u.failed_login_attempts, u.locked_until,
            r.id AS role_id, r.name AS role_name, r.permissions
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?
     LIMIT 1`,
    [email]
  );

  const genericError = NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  const user = rows[0];

  // Account-specific lockout is checked BEFORE the IP throttle below, and
  // returns immediately. This ordering matters: it's what makes the 423
  // "account locked" response actually reachable. If the IP throttle ran
  // first (same 5/15min threshold), it would swallow every request from a
  // genuinely locked-out user with a generic 429 before this check ever ran.
  if (user && user.status === "active" && user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    await logAuthEvent("lockout", { userId: user.id, email, ip, userAgent });
    return NextResponse.json(
      { error: "Account temporarily locked due to repeated failed attempts. Try again later." },
      { status: 423 }
    );
  }

  // IP-based throttle — guards against brute-forcing a not-yet-locked
  // account, or scanning many different email addresses from one IP.
  const rl = checkRateLimit(`login:${ip}`, LOGIN_ATTEMPT_LIMIT, LOCKOUT_MINUTES * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  if (!user || user.status !== "active") {
    await logAuthEvent("login_failed", { email, ip, userAgent });
    return genericError;
  }

  const passwordValid = await verifyPassword(password, user.password);
  if (!passwordValid) {
    const attempts = user.failed_login_attempts + 1;
    const lockedUntil =
      attempts >= LOGIN_ATTEMPT_LIMIT
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null;

    await execute(`UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`, [
      attempts,
      lockedUntil,
      user.id,
    ]);
    await logAuthEvent(
      lockedUntil ? "lockout" : "login_failed",
      { userId: user.id, email, ip, userAgent }
    );
    return genericError;
  }

  // Success — reset lockout counters, stamp last login.
  await execute(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?`,
    [user.id]
  );
  await logAuthEvent("login_success", { userId: user.id, email, ip, userAgent });

  const token = await signSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    roleId: user.role_id,
    roleName: user.role_name,
    permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
  });

  cookies().set(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days — matches default JWT_EXPIRES_IN
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role_name,
    },
  });
}
