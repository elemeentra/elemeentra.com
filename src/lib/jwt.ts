import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getEnv } from "./env";

// Kept in its own module (separate from password.ts) so that middleware —
// which runs on the Edge Runtime — only pulls in `jose` (Edge-compatible)
// and never `bcryptjs` (Node-only: uses the `crypto` module and
// `setImmediate`, neither available on Edge).

export interface SessionPayload extends JWTPayload {
  userId: number;
  email: string;
  name: string;
  roleId: number;
  roleName: string;
  permissions: Record<string, string[]>;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const env = getEnv();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as SessionPayload;
  } catch {
    // Expired, malformed, or tampered — treat all the same: unauthenticated.
    return null;
  }
}
