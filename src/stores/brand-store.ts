/**
 * Brand Store
 *
 * Zustand + localStorage persistence for multi-brand management.
 * Key: "latewiz-brands"
 *
 * Migration: on first hydration, reads the legacy "latewiz-ai-settings"
 * brandProfile (if any) and imports it as the default SavedBrand.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { SavedBrand } from "@/types/brand";

// ============================================================================
// State interface
// ============================================================================

interface BrandState {
  brands: SavedBrand[];
  selectedBrandId: string | null;

  // Actions
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

  // Selectors (pure functions, not persisted)
  getDefaultBrand: () => SavedBrand | null;
  getActiveBrands: () => SavedBrand[];
  getArchivedBrands: () => SavedBrand[];
}

// ============================================================================
// Store
// ============================================================================

export const useBrandStore = create<BrandState>()(
  persist(
    (set, get) => ({
      brands: [],
      selectedBrandId: null,

      createBrand: (input) => {
        const now = new Date().toISOString();
        const newBrand: SavedBrand = {
          ...input,
          id: nanoid(),
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          // If new brand is default, unset default on all others
          const brands = input.isDefault
            ? state.brands.map((b) => ({ ...b, isDefault: false }))
            : [...state.brands];
          return { brands: [...brands, newBrand] };
        });

        return newBrand;
      },

      updateBrand: (id, updates) => {
        set((state) => {
          const brands = state.brands.map((b) => {
            if (b.id !== id) {
              // If we're making this brand default, unset others
              if (updates.isDefault === true) {
                return { ...b, isDefault: false };
              }
              return b;
            }
            return { ...b, ...updates, updatedAt: new Date().toISOString() };
          });
          return { brands };
        });
      },

      deleteBrand: (id) => {
        set((state) => {
          const target = state.brands.find((b) => b.id === id);
          const remaining = state.brands.filter((b) => b.id !== id);

          // If deleted brand was default, promote next non-archived brand
          if (target?.isDefault && remaining.length > 0) {
            const next = remaining.find((b) => !b.isArchived);
            if (next) {
              const updated = remaining.map((b) =>
                b.id === next.id ? { ...b, isDefault: true } : b
              );
              return {
                brands: updated,
                selectedBrandId:
                  state.selectedBrandId === id ? null : state.selectedBrandId,
              };
            }
          }

          return {
            brands: remaining,
            selectedBrandId:
              state.selectedBrandId === id ? null : state.selectedBrandId,
          };
        });
      },

      duplicateBrand: (id) => {
        const source = get().brands.find((b) => b.id === id);
        if (!source) return null;

        const now = new Date().toISOString();
        const copy: SavedBrand = {
          ...source,
          id: nanoid(),
          brandName: `${source.brandName} (Copy)`,
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({ brands: [...state.brands, copy] }));
        return copy;
      },

      archiveBrand: (id) => {
        set((state) => {
          const target = state.brands.find((b) => b.id === id);
          const brands = state.brands.map((b) => {
            if (b.id !== id) return b;
            return { ...b, isArchived: true, isDefault: false, updatedAt: new Date().toISOString() };
          });

          // If archiving the default, promote next active brand
          if (target?.isDefault) {
            const next = brands.find((b) => !b.isArchived && b.id !== id);
            if (next) {
              return {
                brands: brands.map((b) =>
                  b.id === next.id ? { ...b, isDefault: true } : b
                ),
              };
            }
          }

          return { brands };
        });
      },

      restoreBrand: (id) => {
        set((state) => ({
          brands: state.brands.map((b) =>
            b.id === id
              ? { ...b, isArchived: false, updatedAt: new Date().toISOString() }
              : b
          ),
        }));
      },

      setDefaultBrand: (id) => {
        set((state) => ({
          brands: state.brands.map((b) => ({
            ...b,
            isDefault: b.id === id,
            updatedAt:
              b.id === id || b.isDefault
                ? new Date().toISOString()
                : b.updatedAt,
          })),
        }));
      },

      setSelectedBrandId: (id) => set({ selectedBrandId: id }),

      getDefaultBrand: () => {
        return get().brands.find((b) => b.isDefault && !b.isArchived) ?? null;
      },

      getActiveBrands: () => {
        return get().brands.filter((b) => !b.isArchived);
      },

      getArchivedBrands: () => {
        return get().brands.filter((b) => b.isArchived);
      },
    }),
    {
      name: "latewiz-brands",
      partialize: (state) => ({
        brands: state.brands,
        selectedBrandId: state.selectedBrandId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // One-time migration from legacy latewiz-ai-settings brandProfile
        try {
          const raw = localStorage.getItem("latewiz-ai-settings");
          if (!raw) return;

          const parsed = JSON.parse(raw) as {
            state?: { brandProfile?: unknown };
          };
          const bp = parsed?.state?.brandProfile as
            | Record<string, unknown>
            | null
            | undefined;

          if (!bp || typeof bp !== "object") return;

          // Skip if we already have brands (migration already ran)
          if (state.brands.length > 0) return;

          // Check required fields exist
          const requiredFields = [
            "brandName",
            "description",
            "tone",
            "voice",
            "targetAudience",
            "industry",
            "defaultCTA",
          ];
          const hasAll = requiredFields.every(
            (f) => typeof bp[f] === "string" && (bp[f] as string).length > 0
          );
          if (!hasAll) return;

          const now = new Date().toISOString();
          const migrated: SavedBrand = {
            id: nanoid(),
            brandName: bp.brandName as string,
            description: bp.description as string,
            tone: bp.tone as string,
            voice: bp.voice as string,
            targetAudience: bp.targetAudience as string,
            industry: bp.industry as string,
            hashtags: Array.isArray(bp.hashtags) ? (bp.hashtags as string[]) : [],
            doList: Array.isArray(bp.doList) ? (bp.doList as string[]) : [],
            dontList: Array.isArray(bp.dontList) ? (bp.dontList as string[]) : [],
            defaultCTA: bp.defaultCTA as string,
            isDefault: true,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          };

          state.brands = [migrated];
        } catch {
          // Silently ignore migration errors — not worth crashing over
        }
      },
    }
  )
);
