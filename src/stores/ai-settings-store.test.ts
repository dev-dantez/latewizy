/**
 * Tests for AI Settings Store
 *
 * BrandProfile validation has moved to brand-store.ts / brand-store.test.ts.
 * This file covers the remaining store state: generationPrefs, autoScheduleConfig,
 * and generationHistory.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useAISettingsStore } from "./ai-settings-store";
import type { GenerationPrefs } from "@/types/ai";

const DEFAULT_PREFS: GenerationPrefs = {
  defaultModel: "llama-3.3-70b",
  temperature: 0.7,
  maxTokens: 1024,
  numVariants: 3,
  includeHashtags: true,
  includeEmoji: true,
  includeCTA: true,
};

describe("AI Settings Store", () => {
  beforeEach(() => {
    useAISettingsStore.setState({
      generationPrefs: null,
      autoScheduleConfig: null,
      generationHistory: [],
    });
  });

  describe("generationPrefs", () => {
    it("sets prefs from null", () => {
      const { setGenerationPrefs } = useAISettingsStore.getState();
      setGenerationPrefs(DEFAULT_PREFS);
      expect(useAISettingsStore.getState().generationPrefs?.temperature).toBe(0.7);
    });

    it("merges partial updates", () => {
      const { setGenerationPrefs } = useAISettingsStore.getState();
      setGenerationPrefs(DEFAULT_PREFS);
      setGenerationPrefs({ temperature: 0.9 });
      const { generationPrefs } = useAISettingsStore.getState();
      expect(generationPrefs?.temperature).toBe(0.9);
      expect(generationPrefs?.numVariants).toBe(3);
    });
  });

  describe("generationHistory", () => {
    it("starts empty", () => {
      expect(useAISettingsStore.getState().generationHistory).toHaveLength(0);
    });

    it("clears history", () => {
      useAISettingsStore.setState({
        generationHistory: [
          {
            id: "1",
            content: "test",
            hashtags: [],
            mediaItems: [],
            platforms: [],
            topic: "t",
            source: "manual",
            generatedAt: new Date().toISOString(),
            status: "draft",
            brandSnapshot: {
              brandName: "X",
              description: "d",
              tone: "pro",
              voice: "v",
              targetAudience: "all",
              industry: "tech",
              hashtags: [],
              doList: [],
              dontList: [],
              defaultCTA: "cta",
            },
          },
        ],
      });
      useAISettingsStore.getState().clearGenerationHistory();
      expect(useAISettingsStore.getState().generationHistory).toHaveLength(0);
    });
  });
});
