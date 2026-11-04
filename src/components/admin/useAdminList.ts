"use client";

import { getJson, peek } from "@/lib/admin-cache";
import { useCallback, useEffect, useState } from "react";

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Shared list-page state: debounced search, status filter, pagination and
 * row selection. Expects the endpoint to answer with
 * `{ items, pagination, stats? }` (see src/lib/api-utils.ts).
 */
export function useAdminList<T extends { id: number }, S = Record<string, number>>(endpoint: string) {
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [stats, setStats] = useState<S | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilterState] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    const url = `${endpoint}?${params.toString()}`;
    const hit = peek(url);
    if (hit && Array.isArray(hit.items)) {
      // Instant paint from the last visit; the fresh copy replaces it below.
      setItems(hit.items);
      setPagination(hit.pagination);
      setStats(hit.stats ?? null);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const res = await getJson(url);
      const data = res.data;
      if (!res.ok) {
        setLoadError(data.error ?? "Failed to load data.");
        return;
      }
      // A delete on the last page can leave it empty — step back one page.
      if (data.items.length === 0 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
        return;
      }
      setItems(data.items);
      setPagination(data.pagination);
      setStats(data.stats ?? null);
      setSelected(new Set());
      setLoadError(null);
    } catch {
      setLoadError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function setStatusFilter(value: string) {
    setStatusFilterState(value);
    setPage(1);
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  return {
    items,
    setItems,
    pagination,
    stats,
    loading,
    loadError,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    selected,
    setSelected,
    toggleOne,
    toggleAll,
    reload: load,
  };
}
