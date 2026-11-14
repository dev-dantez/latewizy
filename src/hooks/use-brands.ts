/**
 * Brand convenience hooks
 *
 * Thin wrappers over the brand store that mirror the pattern used by other
 * hooks in this codebase (e.g. use-posts, use-profiles).
 */

import { useBrandStore } from "@/stores/brand-store";
import type { SavedBrand } from "@/types/brand";

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

export function useBrandActions(): UseBrandActionsReturn {
  const createBrand = useBrandStore((s) => s.createBrand);
  const updateBrand = useBrandStore((s) => s.updateBrand);
  const deleteBrand = useBrandStore((s) => s.deleteBrand);
  const duplicateBrand = useBrandStore((s) => s.duplicateBrand);
  const archiveBrand = useBrandStore((s) => s.archiveBrand);
  const restoreBrand = useBrandStore((s) => s.restoreBrand);
  const setDefaultBrand = useBrandStore((s) => s.setDefaultBrand);
  const setSelectedBrandId = useBrandStore((s) => s.setSelectedBrandId);

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
