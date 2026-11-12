import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  // User preferences
  timezone: string;
  defaultProfileId: string | null;

  // UI state
  sidebarOpen: boolean;

  // Actions
  setTimezone: (timezone: string) => void;
  setDefaultProfileId: (profileId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      defaultProfileId: null,
      sidebarOpen: true,

      setTimezone: (timezone) => set({ timezone }),
      setDefaultProfileId: (profileId) => set({ defaultProfileId: profileId }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: "latewiz-app",
      partialize: (state) => ({
        timezone: state.timezone,
        defaultProfileId: state.defaultProfileId,
      }),
    }
  )
);
