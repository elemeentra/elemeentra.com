"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination as PaginationData } from "./useAdminList";

export function Pagination({
  pagination,
  onPage,
}: {
  pagination: PaginationData | null;
  onPage: (page: number) => void;
}) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, pageSize, total, totalPages } = pagination;

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-xs text-muted">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-sm text-foreground">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
