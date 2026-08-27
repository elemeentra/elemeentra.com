import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { verifySessionToken } from "@/lib/jwt";

export async function GET() {
  const env = getEnv();
  const token = cookies().get(env.COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.roleName,
      permissions: session.permissions,
    },
  });
}
