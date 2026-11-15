import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UsageStats {
  planName: string;
  limits: {
    uploads: number;
    profiles: number;
  };
  usage: {
    uploads: number;
    profiles: number;
  };
}

export interface Account {
  apiKey: string;
  label: string; // e.g. "Account 1", or planName once validated
  usageStats: UsageStats | null;
  /** Last selected profile ID for this Zernio workspace. Null = auto-select first. */
  defaultProfileId: string | null;
}

// Normalize usage stats at the boundary (API responses + localStorage rehydration).
// Guarantees the full shape so render code can trust .toLocaleString() on every field.
// Without this, a stale persisted shape or a partial API response crashes the dashboard
// during hydration with "Cannot read properties of undefined (reading 'toLocaleString')".
function normalizeUsageStats(stats: unknown): UsageStats | null {
  if (!stats || typeof stats !== "object") return null;
  const s = stats as Partial<UsageStats> & {
    limits?: Partial<UsageStats["limits"]>;
    usage?: Partial<UsageStats["usage"]>;
  };
  const num = (v: unknown, fallback = 0): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    planName: typeof s.planName === "string" && s.planName.length > 0 ? s.planName : "Free",
    limits: {
      uploads: num(s.limits?.uploads),
      profiles: num(s.limits?.profiles),
    },
    usage: {
      uploads: num(s.usage?.uploads),
      profiles: num(s.usage?.profiles),
    },
  };
}

function normalizeAccount(a: unknown): Account | null {
  if (!a || typeof a !== "object") return null;
  const acc = a as Partial<Account>;
  if (typeof acc.apiKey !== "string" || !acc.apiKey) return null;
  return {
    apiKey: acc.apiKey,
    label: typeof acc.label === "string" && acc.label.length > 0 ? acc.label : "Account",
    usageStats: normalizeUsageStats(acc.usageStats),
    defaultProfileId: typeof acc.defaultProfileId === "string" ? acc.defaultProfileId : null,
  };
}

interface AuthState {
  // Multi-account list
  accounts: Account[];
  activeAccountIndex: number;

  // Derived convenience getters (not persisted -- computed from accounts)
  apiKey: string | null;
  usageStats: UsageStats | null;
  /** The stored profile ID for the active account. Null means auto-select first. */
  activeProfileId: string | null;

  isValidating: boolean;
  error: string | null;
  hasHydrated: boolean;

  // Actions
  addAccount: (apiKey: string, usageStats: UsageStats | null) => void;
  removeAccount: (index: number) => void;
  switchAccount: (index: number) => void;
  updateActiveUsageStats: (stats: UsageStats | null) => void;
  /** Save the chosen profile ID for the currently active account. */
  setActiveProfileId: (profileId: string | null) => void;

  /** @deprecated use addAccount -- kept for modal back-compat */
  setApiKey: (key: string | null) => void;
  /** @deprecated use updateActiveUsageStats */
  setUsageStats: (stats: UsageStats | null) => void;

  setIsValidating: (validating: boolean) => void;
  setError: (error: string | null) => void;
  setHasHydrated: (hydrated: boolean) => void;
  logout: () => void;
}

function deriveActive(accounts: Account[], index: number) {
  const acc = accounts[index] ?? null;
  return {
    apiKey: acc?.apiKey ?? null,
    usageStats: acc?.usageStats ?? null,
    activeProfileId: acc?.defaultProfileId ?? null,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accounts: [],
      activeAccountIndex: 0,
      apiKey: null,
      usageStats: null,
      activeProfileId: null,
      isValidating: false,
      error: null,
      hasHydrated: false,

      addAccount: (apiKey, usageStats) =>
        set((state) => {
          // Avoid duplicate keys
          const existing = state.accounts.findIndex((a) => a.apiKey === apiKey);
          if (existing !== -1) {
            // Just switch to it and refresh stats
            const updated = state.accounts.map((a, i) =>
              i === existing
                ? { ...a, usageStats: normalizeUsageStats(usageStats), label: normalizeUsageStats(usageStats)?.planName ?? a.label }
                : a
            );
            return {
              accounts: updated,
              activeAccountIndex: existing,
              ...deriveActive(updated, existing),
              error: null,
            };
          }
          const newAccount: Account = {
            apiKey,
            label: normalizeUsageStats(usageStats)?.planName ?? `Account ${state.accounts.length + 1}`,
            usageStats: normalizeUsageStats(usageStats),
            defaultProfileId: null,
          };
          const updated = [...state.accounts, newAccount];
          const newIndex = updated.length - 1;
          return {
            accounts: updated,
            activeAccountIndex: newIndex,
            ...deriveActive(updated, newIndex),
            error: null,
          };
        }),

      removeAccount: (index) =>
        set((state) => {
          if (state.accounts.length <= 1) {
            // Removing the last account = full logout
            return { accounts: [], activeAccountIndex: 0, apiKey: null, usageStats: null, error: null };
          }
          const updated = state.accounts.filter((_, i) => i !== index);
          const newIndex = Math.min(state.activeAccountIndex, updated.length - 1);
          return {
            accounts: updated,
            activeAccountIndex: newIndex,
            ...deriveActive(updated, newIndex),
          };
        }),

      switchAccount: (index) =>
        set((state) => {
          if (index < 0 || index >= state.accounts.length) return state;
          return {
            activeAccountIndex: index,
            ...deriveActive(state.accounts, index),
          };
        }),

      updateActiveUsageStats: (stats) =>
        set((state) => {
          const normalized = normalizeUsageStats(stats);
          const updated = state.accounts.map((a, i) =>
            i === state.activeAccountIndex ? { ...a, usageStats: normalized } : a
          );
          return { accounts: updated, usageStats: normalized };
        }),

      setActiveProfileId: (profileId) =>
        set((state) => {
          const updated = state.accounts.map((a, i) =>
            i === state.activeAccountIndex ? { ...a, defaultProfileId: profileId } : a
          );
          return { accounts: updated, activeProfileId: profileId };
        }),

      // Back-compat shims
      setApiKey: (key) => {
        if (!key) {
          get().logout();
        } else {
          get().addAccount(key, null);
        }
      },
      setUsageStats: (stats) => get().updateActiveUsageStats(stats),

      setIsValidating: (validating) => set({ isValidating: validating }),
      setError: (error) => set({ error }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

      logout: () =>
        set({
          accounts: [],
          activeAccountIndex: 0,
          apiKey: null,
          usageStats: null,
          activeProfileId: null,
          error: null,
        }),
    }),
    {
      name: "latewiz-auth",
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountIndex: state.activeAccountIndex,
        // Keep legacy fields so old stored data round-trips gracefully
        apiKey: state.apiKey,
        usageStats: state.usageStats,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Migrate: old storage had a single apiKey/usageStats, no accounts array
        const legacy = state as AuthState & { apiKey?: string | null; usageStats?: unknown };
        if ((!state.accounts || state.accounts.length === 0) && legacy.apiKey) {
          const migratedAccount: Account = {
            apiKey: legacy.apiKey,
            label: normalizeUsageStats(legacy.usageStats)?.planName ?? "Account 1",
            usageStats: normalizeUsageStats(legacy.usageStats),
            defaultProfileId: null,
          };
          state.accounts = [migratedAccount];
          state.activeAccountIndex = 0;
        } else {
          // Normalize each account in the array
          state.accounts = (state.accounts ?? [])
            .map(normalizeAccount)
            .filter((a): a is Account => a !== null);
          state.activeAccountIndex = Math.min(
            state.activeAccountIndex ?? 0,
            Math.max(0, state.accounts.length - 1)
          );
        }

        // Re-derive convenience fields
        const active = state.accounts[state.activeAccountIndex] ?? null;
        state.apiKey = active?.apiKey ?? null;
        state.usageStats = active?.usageStats ?? null;
        state.activeProfileId = active?.defaultProfileId ?? null;

        state.setHasHydrated(true);
      },
    }
  )
);
