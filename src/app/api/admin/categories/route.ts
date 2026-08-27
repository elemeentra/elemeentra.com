import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { generateUniqueSlug } from "@/lib/slugify";
export async function GET(request: NextRequest) { return withApiError(async () => { await requirePermission(request, "blog", "view"); return NextResponse.json({ categories: await query<RowDataPacket>("SELECT id, name, slug FROM categories ORDER BY name ASC") }); }); }
export async function POST(request: NextRequest) { return withApiError(async () => { await requirePermission(request, "blog", "create"); const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid name." }, { status: 400 }); const result = await execute("INSERT INTO categories (name, slug) VALUES (?, ?)", [parsed.data.name, await generateUniqueSlug("categories", parsed.data.name)]); return NextResponse.json({ id: result.insertId }, { status: 201 }); }); }