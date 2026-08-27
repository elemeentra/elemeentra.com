"use client";

import { usePathname } from "next/navigation";

/**
 * The admin panel's secret entry segment (ADMIN_PATH) must never be
 * hardcoded in client bundles — that would defeat the point of hiding it.
 * Instead, every admin page already knows the segment because it's sitting
 * right there in the current URL. This hook extracts it so links, redirects,
 * and fetches inside the admin UI stay correct regardless of what the
 * secret is configured to on a given environment.
 */
export function useAdminBase(): string {
  const pathname = usePathname();
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment ? `/${firstSegment}` : "/admin";
}
