import { NextRequest, NextResponse } from "next/server";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { loadSettingsGroup, saveSettingsGroup } from "@/lib/settings";

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "settings", "view");
    return NextResponse.json({ values: await loadSettingsGroup("general") });
  });
}

export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "settings", "edit");
    const result = await saveSettingsGroup("general", await request.json().catch(() => null));
    if (!result.ok) {
      return NextResponse.json({ error: "Invalid input.", issues: result.issues }, { status: 400 });
    }
    return NextResponse.json({ values: result.values });
  });
}
