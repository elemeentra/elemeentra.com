import { z } from "zod";
import type { NextRequest } from "next/server";
import { ApiError } from "./api-auth";

export const PAGE_SIZE = 20;

/** Parses a numeric route param, throwing a 400 ApiError if invalid. */
export function parseId(raw: string, label = "item"): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, `Invalid ${label} id.`);
  return id;
}

/** Shared schema for bulk endpoints. Capped so one request can't build a giant IN (...) list. */
export const idsSchema = z.array(z.number().int().positive()).min(1).max(500);

export function getPageParams(request: NextRequest): { page: number; offset: number } {
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  return { page, offset: (page - 1) * PAGE_SIZE };
}

export function buildPagination(page: number, total: number) {
  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Builds a LIKE pattern, escaping % and _ so user input can't act as a wildcard. */
export function likeTerm(search: string): string {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(",");
}
