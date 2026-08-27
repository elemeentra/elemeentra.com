import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

export async function POST() {
  const env = getEnv();
  cookies().delete(env.COOKIE_NAME);
  return NextResponse.json({ success: true });
}
