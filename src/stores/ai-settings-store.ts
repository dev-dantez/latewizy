import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BrandProfile,
  GenerationPrefs,
  AutoScheduleConfig,
  GeneratedPostDraft,
} from "@/types/ai";

interface AISettingsState {
  // Brand configuration
  brandProfile: BrandProfile | null;
  // AI generation preferences
  generationPrefs: GenerationPrefs | null;
  // Auto-schedule configuration
  autoScheduleConfig: AutoScheduleConfig | null;
  // Generation history (last 50)
  generationHistory: GeneratedPostDraft[];

  // Actions
  setBrandProfile: (profile: Partial<BrandProfile>) => void;
  setGenerationPrefs: (prefs: Partial<GenerationPrefs>) => void;
  setAutoScheduleConfig: (config: Partial<AutoScheduleConfig>) => void;
  addGenerationHistory: (draft: GeneratedPostDraft) => void;
  clearGenerationHistory: () => void;
}

/**
 * Validates BrandProfile fields according to requirements 4.7-4.12
 * Throws an error if any field validation fails
 */
function validateBrandProfile(profile: Partial<BrandProfile>): void {
  // Validate brandName: non-empty, max 100 characters
  if (profile.brandName !== undefined) {
    if (
      typeof profile.brandName !== "string" ||
      profile.brandName.trim().length === 0
    ) {
      throw new Error("brandName must be a non-empty string");
    }
    if (profile.brandName.length > 100) {
      throw new Error("brandName must be at most 100 characters");
    }
  }

  // Validate tone: non-empty, max 50 characters
  if (profile.tone !== undefined) {
    if (typeof profile.tone !== "string" || profile.tone.trim().length === 0) {
      throw new Error("tone must be a non-empty string");
    }
    if (profile.tone.length > 50) {
      throw new Error("tone must be at most 50 characters");
    }
  }

  // Validate description: non-empty, max 500 characters
  if (profile.description !== undefined) {
    if (
      typeof profile.description !== "string" ||
      profile.description.trim().length === 0
    ) {
      throw new Error("description must be a non-empty string");
    }
    if (profile.description.length > 500) {
      throw new Error("description must be at most 500 characters");
    }
  }

  // Validate voice: non-empty, max 200 characters
  if (profile.voice !== undefined) {
    if (typeof profile.voice !== "string" || profile.voice.trim().length === 0) {
      throw new Error("voice must be a non-empty string");
    }
    if (profile.voice.length > 200) {
      throw new Error("voice must be at most 200 characters");
    }
  }

  // Validate targetAudience: non-empty, max 200 characters
  if (profile.targetAudience !== undefined) {
    if (
      typeof profile.targetAudience !== "string" ||
      profile.targetAudience.trim().length === 0
    ) {
      throw new Error("targetAudience must be a non-empty string");
    }
    if (profile.targetAudience.length > 200) {
      throw new Error("targetAudience must be at most 200 characters");
    }
  }

  // Validate industry: non-empty, max 100 characters
  if (profile.industry !== undefined) {
    if (
      typeof profile.industry !== "string" ||
      profile.industry.trim().length === 0
    ) {
      throw new Error("industry must be a non-empty string");
    }
    if (profile.industry.length > 100) {
      throw new Error("industry must be at most 100 characters");
    }
  }

  // Validate defaultCTA: non-empty, max 200 characters
  if (profile.defaultCTA !== undefined) {
    if (
      typeof profile.defaultCTA !== "string" ||
      profile.defaultCTA.trim().length === 0
    ) {
      throw new Error("defaultCTA must be a non-empty string");
    }
    if (profile.defaultCTA.length > 200) {
      throw new Error("defaultCTA must be at most 200 characters");
    }
  }

  // Validate hashtags: each must start with "#", max 30 tags
  if (profile.hashtags !== undefined) {
    if (!Array.isArray(profile.hashtags)) {
      throw new Error("hashtags must be an array");
    }
    if (profile.hashtags.length > 30) {
      throw new Error("hashtags must contain at most 30 tags");
    }
    for (const tag of profile.hashtags) {
      if (typeof tag !== "string" || !tag.startsWith("#")) {
        throw new Error('Each hashtag must be a string starting with "#"');
      }
    }
  }

  // Validate doList: max 10 items, max 200 characters per item
  if (profile.doList !== undefined) {
    if (!Array.isArray(profile.doList)) {
      throw new Error("doList must be an array");
    }
    if (profile.doList.length > 10) {
      throw new Error("doList must contain at most 10 items");
    }
    for (const item of profile.doList) {
      if (typeof item !== "string" || item.length > 200) {
        throw new Error(
          "Each doList item must be a string with at most 200 characters"
        );
      }
    }
  }

  // Validate dontList: max 10 items, max 200 characters per item
  if (profile.dontList !== undefined) {
    if (!Array.isArray(profile.dontList)) {
      throw new Error("dontList must be an array");
    }
    if (profile.dontList.length > 10) {
      throw new Error("dontList must contain at most 10 items");
    }
    for (const item of profile.dontList) {
      if (typeof item !== "string" || item.length > 200) {
        throw new Error(
          "Each dontList item must be a string with at most 200 characters"
        );
      }
    }
  }
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      brandProfile: null,
      generationPrefs: null,
      autoScheduleConfig: null,
      generationHistory: [],

      setBrandProfile: (profile) => {
        // Validate the partial profile
        try {
          validateBrandProfile(profile);
        } catch (error) {
          // Validation failed - reject the update and throw
          console.error("BrandProfile validation failed:", error);
          throw error;
        }

        // Merge partial update with existing profile
        set((state) => ({
          brandProfile: state.brandProfile
            ? { ...state.brandProfile, ...profile }
            : (profile as BrandProfile),
        }));
      },

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
        brandProfile: state.brandProfile,
        generationPrefs: state.generationPrefs,
        autoScheduleConfig: state.autoScheduleConfig,
        generationHistory: state.generationHistory,
      }),
    }
  )
);
