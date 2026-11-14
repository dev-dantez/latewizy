import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  GenerationPrefs,
  AutoScheduleConfig,
  GeneratedPostDraft,
} from "@/types/ai";

interface AISettingsState {
  // AI generation preferences
  generationPrefs: GenerationPrefs | null;
  // Auto-schedule configuration
  autoScheduleConfig: AutoScheduleConfig | null;
  // Generation history (last 50)
  generationHistory: GeneratedPostDraft[];

  // Actions
  setGenerationPrefs: (prefs: Partial<GenerationPrefs>) => void;
  setAutoScheduleConfig: (config: Partial<AutoScheduleConfig>) => void;
  addGenerationHistory: (draft: GeneratedPostDraft) => void;
  clearGenerationHistory: () => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      generationPrefs: null,
      autoScheduleConfig: null,
      generationHistory: [],

      setGenerationPrefs: (prefs) => {
        // Merge partial update with existing preferences
        set((state) => ({
          generationPrefs: state.generationPrefs
            ? { ...state.generationPrefs, ...prefs }
            : (prefs as GenerationPrefs),
        }));
      },

      setAutoScheduleConfig: (config) => {
        // Merge partial update with existing configuration
        set((state) => ({
          autoScheduleConfig: state.autoScheduleConfig
            ? { ...state.autoScheduleConfig, ...config }
            : (config as AutoScheduleConfig),
        }));
      },

      addGenerationHistory: (draft) => {
        set((state) => {
          // Prepend the new draft to history
          const updatedHistory = [draft, ...state.generationHistory];
          // Truncate to maximum 50 entries
          return {
            generationHistory: updatedHistory.slice(0, 50),
          };
        });
      },

      clearGenerationHistory: () => {
        set({ generationHistory: [] });
      },
    }),
    {
      name: "latewiz-ai-settings",
      partialize: (state) => ({
        generationPrefs: state.generationPrefs,
        autoScheduleConfig: state.autoScheduleConfig,
        generationHistory: state.generationHistory,
      }),
    }
  )
);
