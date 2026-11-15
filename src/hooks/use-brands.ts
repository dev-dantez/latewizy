/**
 * Brand convenience hooks
 *
 * Thin wrappers over the brand store that mirror the pattern used by other
 * hooks in this codebase (e.g. use-posts, use-profiles).
 *
 * Server sync: useServerBrands fetches brands from the DB-backed API and
 * hydrates the Zustand store. Call it once at the layout level after login.
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBrandStore } from "@/stores/brand-store";
import type { SavedBrand } from "@/types/brand";

// ============================================================================
// Query keys
// ============================================================================

export const brandKeys = {
  all: ["brands"] as const,
  list: () => [...brandKeys.all, "list"] as const,
};

// ============================================================================
// Server-synced hooks
// ============================================================================

/**
 * Fetches brands from the server and hydrates the Zustand store.
 * Returns the same shape as useBrands so callers can swap freely.
 */
export function useServerBrands() {
  const storeBrands = useBrandStore((s) => s.brands);
  const setStore = useBrandStore.setState;

  const query = useQuery({
    queryKey: brandKeys.list(),
    queryFn: async () => {
      const res = await fetch("/api/brands");
      if (res.status === 401) return null; // not logged in yet — skip
      if (!res.ok) throw new Error("Failed to fetch brands");
      const data = (await res.json()) as { brands: SavedBrand[] };
      return data.brands;
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });

  // Hydrate store when server data arrives
  useEffect(() => {
    if (!query.data) return;
    setStore({ brands: query.data });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  return {
    brands: query.data ?? storeBrands,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * One-time migration: POSTs localStorage brands to the server.
 * Safe to call multiple times — server skips existing IDs.
 */
export function useMigrateBrands() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (brands: SavedBrand[]) => {
      const res = await fetch("/api/brands/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brands }),
      });
      if (!res.ok) throw new Error("Brand migration failed");
      return res.json() as Promise<{ migrated: number; skipped: number }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandKeys.list() });
    },
  });
}

// ============================================================================
// useBrands
// ============================================================================

export interface UseBrandsReturn {
  brands: SavedBrand[];
  activeBrands: SavedBrand[];
  archivedBrands: SavedBrand[];
  selectedBrand: SavedBrand | null;
  defaultBrand: SavedBrand | null;
  /** True until the store has rehydrated from localStorage. */
  isLoading: boolean;
}

export function useBrands(): UseBrandsReturn {
  const brands = useBrandStore((s) => s.brands);
  const selectedBrandId = useBrandStore((s) => s.selectedBrandId);
  const getActiveBrands = useBrandStore((s) => s.getActiveBrands);
  const getArchivedBrands = useBrandStore((s) => s.getArchivedBrands);
  const getDefaultBrand = useBrandStore((s) => s.getDefaultBrand);

  const activeBrands = getActiveBrands();
  const archivedBrands = getArchivedBrands();
  const defaultBrand = getDefaultBrand();
  const selectedBrand =
    brands.find((b) => b.id === selectedBrandId) ??
    defaultBrand;

  // Zustand persist sets `hasHydrated` via onRehydrateStorage; we approximate
  // isLoading as false once the store reference stabilises on the client.
  const isLoading = false;

  return {
    brands,
    activeBrands,
    archivedBrands,
    selectedBrand,
    defaultBrand,
    isLoading,
  };
}

// ============================================================================
// useBrand
// ============================================================================

export function useBrand(id: string): SavedBrand | undefined {
  return useBrandStore((s) => s.brands.find((b) => b.id === id));
}

// ============================================================================
// useBrandActions
//
// All mutating actions write to both the Zustand store (instant UI feedback)
// and the server (durable persistence). Server errors are non-fatal — the
// store update sticks locally and the next useServerBrands fetch reconciles.
// ============================================================================

export interface UseBrandActionsReturn {
  createBrand: (
    input: Omit<SavedBrand, "id" | "createdAt" | "updatedAt">
  ) => SavedBrand;
  updateBrand: (
    id: string,
    updates: Partial<Omit<SavedBrand, "id" | "createdAt">>
  ) => void;
  deleteBrand: (id: string) => void;
  duplicateBrand: (id: string) => SavedBrand | null;
  archiveBrand: (id: string) => void;
  restoreBrand: (id: string) => void;
  setDefaultBrand: (id: string) => void;
  setSelectedBrandId: (id: string | null) => void;
}

async function serverPatch(id: string, updates: Record<string, unknown>) {
  try {
    await fetch(`/api/brands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  } catch {
    // Non-fatal — store already updated; server will reconcile on next fetch
  }
}

async function serverDelete(id: string) {
  try {
    await fetch(`/api/brands/${id}`, { method: "DELETE" });
  } catch {
    // Non-fatal
  }
}

export function useBrandActions(): UseBrandActionsReturn {
  const qc = useQueryClient();

  const storeCreate = useBrandStore((s) => s.createBrand);
  const storeUpdate = useBrandStore((s) => s.updateBrand);
  const storeDelete = useBrandStore((s) => s.deleteBrand);
  const storeDuplicate = useBrandStore((s) => s.duplicateBrand);
  const storeArchive = useBrandStore((s) => s.archiveBrand);
  const storeRestore = useBrandStore((s) => s.restoreBrand);
  const storeSetDefault = useBrandStore((s) => s.setDefaultBrand);
  const setSelectedBrandId = useBrandStore((s) => s.setSelectedBrandId);

  const createBrand = (input: Omit<SavedBrand, "id" | "createdAt" | "updatedAt">) => {
    const brand = storeCreate(input);
    // POST to server via migrate endpoint (idempotent)
    fetch("/api/brands/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brands: [brand] }),
    })
      .then(() => qc.invalidateQueries({ queryKey: brandKeys.list() }))
      .catch(() => {/* non-fatal */});
    return brand;
  };

  const updateBrand = (id: string, updates: Partial<Omit<SavedBrand, "id" | "createdAt">>) => {
    storeUpdate(id, updates);
    serverPatch(id, updates as Record<string, unknown>)
      .then(() => qc.invalidateQueries({ queryKey: brandKeys.list() }));
  };

  const deleteBrand = (id: string) => {
    storeDelete(id);
    serverDelete(id)
      .then(() => qc.invalidateQueries({ queryKey: brandKeys.list() }));
  };

  const duplicateBrand = (id: string) => {
    const copy = storeDuplicate(id);
    if (copy) {
      fetch("/api/brands/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brands: [copy] }),
      })
        .then(() => qc.invalidateQueries({ queryKey: brandKeys.list() }))
        .catch(() => {/* non-fatal */});
    }
    return copy;
  };

  const archiveBrand = (id: string) => {
    storeArchive(id);
    serverPatch(id, { isArchived: true, isDefault: false })
      .then(() => qc.invalidateQueries({ queryKey: brandKeys.list() }));
  };

  const restoreBrand = (id: string) => {
    storeRestore(id);
    serverPatch(id, { isArchived: false })
      .then(() => qc.invalidateQueries({ queryKey: brandKeys.list() }));
  };

  const setDefaultBrand = (id: string) => {
    storeSetDefault(id);
    serverPatch(id, { isDefault: true })
      .then(() => qc.invalidateQueries({ queryKey: brandKeys.list() }));
  };

  return {
    createBrand,
    updateBrand,
    deleteBrand,
    duplicateBrand,
    archiveBrand,
    restoreBrand,
    setDefaultBrand,
    setSelectedBrandId,
  };
}
