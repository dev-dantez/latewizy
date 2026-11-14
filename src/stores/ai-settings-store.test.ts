/**
 * Tests for AI Settings Store BrandProfile validation
 * 
 * Validates requirements 4.7-4.12:
 * - brandName validation (non-empty, max 100 chars)
 * - tone validation (non-empty, max 50 chars)
 * - hashtags validation (each starts with "#", max 30 tags)
 * - doList and dontList validation (max 10 items, max 200 chars per item)
 * - description, voice, targetAudience, industry, defaultCTA validation (max lengths)
 * - Rejection of invalid updates with error messages
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useAISettingsStore } from "./ai-settings-store";
import type { BrandProfile } from "@/types/ai";

describe("AI Settings Store - BrandProfile Validation", () => {
  beforeEach(() => {
    // Reset store state before each test
    useAISettingsStore.setState({
      brandProfile: null,
      generationPrefs: null,
      autoScheduleConfig: null,
      generationHistory: [],
    });
  });

  describe("brandName validation (Requirement 4.7)", () => {
    it("should accept valid brandName", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      expect(() => {
        setBrandProfile({ brandName: "Valid Brand" });
      }).not.toThrow();
      
      const state = useAISettingsStore.getState();
      expect(state.brandProfile?.brandName).toBe("Valid Brand");
    });

    it("should reject empty brandName", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      expect(() => {
        setBrandProfile({ brandName: "" });
      }).toThrow("brandName must be a non-empty string");
    });

    it("should reject whitespace-only brandName", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      expect(() => {
        setBrandProfile({ brandName: "   " });
      }).toThrow("brandName must be a non-empty string");
    });

    it("should reject brandName exceeding 100 characters", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      const longName = "a".repeat(101);
      
      expect(() => {
        setBrandProfile({ brandName: longName });
      }).toThrow("brandName must be at most 100 characters");
    });

    it("should accept brandName with exactly 100 characters", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      const exactName = "a".repeat(100);
      
      expect(() => {
        setBrandProfile({ brandName: exactName });
      }).not.toThrow();
    });
  });

  describe("tone validation (Requirement 4.8)", () => {
    it("should accept valid tone", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      expect(() => {
        setBrandProfile({ tone: "professional" });
      }).not.toThrow();
      
      const state = useAISettingsStore.getState();
      expect(state.brandProfile?.tone).toBe("professional");
    });

    it("should reject empty tone", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      expect(() => {
        setBrandProfile({ tone: "" });
      }).toThrow("tone must be a non-empty string");
    });

    it("should reject whitespace-only tone", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      expect(() => {
        setBrandProfile({ tone: "   " });
      }).toThrow("tone must be a non-empty string");
    });

    it("should reject tone exceeding 50 characters", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      const longTone = "a".repeat(51);
      
      expect(() => {
        setBrandProfile({ tone: longTone });
      }).toThrow("tone must be at most 50 characters");
    });

    it("should accept tone with exactly 50 characters", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      const exactTone = "a".repeat(50);
      
      expect(() => {
        setBrandProfile({ tone: exactTone });
      }).not.toThrow();
    });
  });

  describe("hashtags validation (Requirement 4.9)", () => {
    it("should accept valid hashtags", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      expect(() => {
        setBrandProfile({ hashtags: ["#brand", "#marketing", "#social"] });
      }).not.toThrow();
      
      const state = useAISettingsStore.getState();
      expect(state.brandProfile?.hashtags).toEqual(["#brand", "#marketing", "#social"]);
    });

    it("should reject hashtags not starting with #", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      expect(() => {
        setBrandProfile({ hashtags: ["brand", "#marketing"] });
      }).toThrow('Each hashtag must be a string starting with "#"');
    });

    it("should reject hashtags exceeding 30 tags", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      const manyHashtags = Array.from({ length: 31 }, (_, i) => `#tag${i}`);
      
      expect(() => {
        setBrandProfile({ hashtags: manyHashtags });
      }).toThrow("hashtags must contain at most 30 tags");
    });

    it("should accept exactly 30 hashtags", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      const exactHashtags = Array.from({ length: 30 }, (_, i) => `#tag${i}`);
      
      expect(() => {
        setBrandProfile({ hashtags: exactHashtags });
      }).not.toThrow();
    });

    it("should reject non-array hashtags", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      expect(() => {
        setBrandProfile({ hashtags: "#invalid" as any });
      }).toThrow("hashtags must be an array");
    });
  });

  describe("doList and dontList validation (Requirement 4.10)", () => {
    describe("doList", () => {
      it("should accept valid doList", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ doList: ["Be authentic", "Engage with audience"] });
        }).not.toThrow();
        
        const state = useAISettingsStore.getState();
        expect(state.brandProfile?.doList).toEqual(["Be authentic", "Engage with audience"]);
      });

      it("should reject doList exceeding 10 items", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const manyItems = Array.from({ length: 11 }, (_, i) => `Item ${i}`);
        
        expect(() => {
          setBrandProfile({ doList: manyItems });
        }).toThrow("doList must contain at most 10 items");
      });

      it("should accept exactly 10 doList items", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const exactItems = Array.from({ length: 10 }, (_, i) => `Item ${i}`);
        
        expect(() => {
          setBrandProfile({ doList: exactItems });
        }).not.toThrow();
      });

      it("should reject doList item exceeding 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const longItem = "a".repeat(201);
        
        expect(() => {
          setBrandProfile({ doList: [longItem] });
        }).toThrow("Each doList item must be a string with at most 200 characters");
      });

      it("should accept doList item with exactly 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const exactItem = "a".repeat(200);
        
        expect(() => {
          setBrandProfile({ doList: [exactItem] });
        }).not.toThrow();
      });

      it("should reject non-array doList", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ doList: "invalid" as any });
        }).toThrow("doList must be an array");
      });
    });

    describe("dontList", () => {
      it("should accept valid dontList", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ dontList: ["Avoid spam", "No negativity"] });
        }).not.toThrow();
        
        const state = useAISettingsStore.getState();
        expect(state.brandProfile?.dontList).toEqual(["Avoid spam", "No negativity"]);
      });

      it("should reject dontList exceeding 10 items", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const manyItems = Array.from({ length: 11 }, (_, i) => `Item ${i}`);
        
        expect(() => {
          setBrandProfile({ dontList: manyItems });
        }).toThrow("dontList must contain at most 10 items");
      });

      it("should accept exactly 10 dontList items", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const exactItems = Array.from({ length: 10 }, (_, i) => `Item ${i}`);
        
        expect(() => {
          setBrandProfile({ dontList: exactItems });
        }).not.toThrow();
      });

      it("should reject dontList item exceeding 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const longItem = "a".repeat(201);
        
        expect(() => {
          setBrandProfile({ dontList: [longItem] });
        }).toThrow("Each dontList item must be a string with at most 200 characters");
      });

      it("should accept dontList item with exactly 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const exactItem = "a".repeat(200);
        
        expect(() => {
          setBrandProfile({ dontList: [exactItem] });
        }).not.toThrow();
      });

      it("should reject non-array dontList", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ dontList: "invalid" as any });
        }).toThrow("dontList must be an array");
      });
    });
  });

  describe("other field validations (Requirement 4.11, 4.12)", () => {
    describe("description", () => {
      it("should accept valid description", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ description: "A great brand" });
        }).not.toThrow();
      });

      it("should reject empty description", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ description: "" });
        }).toThrow("description must be a non-empty string");
      });

      it("should reject description exceeding 500 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const longDesc = "a".repeat(501);
        
        expect(() => {
          setBrandProfile({ description: longDesc });
        }).toThrow("description must be at most 500 characters");
      });

      it("should accept description with exactly 500 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const exactDesc = "a".repeat(500);
        
        expect(() => {
          setBrandProfile({ description: exactDesc });
        }).not.toThrow();
      });
    });

    describe("voice", () => {
      it("should accept valid voice", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ voice: "expert but approachable" });
        }).not.toThrow();
      });

      it("should reject empty voice", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ voice: "" });
        }).toThrow("voice must be a non-empty string");
      });

      it("should reject voice exceeding 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const longVoice = "a".repeat(201);
        
        expect(() => {
          setBrandProfile({ voice: longVoice });
        }).toThrow("voice must be at most 200 characters");
      });

      it("should accept voice with exactly 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const exactVoice = "a".repeat(200);
        
        expect(() => {
          setBrandProfile({ voice: exactVoice });
        }).not.toThrow();
      });
    });

    describe("targetAudience", () => {
      it("should accept valid targetAudience", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ targetAudience: "small business owners" });
        }).not.toThrow();
      });

      it("should reject empty targetAudience", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ targetAudience: "" });
        }).toThrow("targetAudience must be a non-empty string");
      });

      it("should reject targetAudience exceeding 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const longAudience = "a".repeat(201);
        
        expect(() => {
          setBrandProfile({ targetAudience: longAudience });
        }).toThrow("targetAudience must be at most 200 characters");
      });

      it("should accept targetAudience with exactly 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const exactAudience = "a".repeat(200);
        
        expect(() => {
          setBrandProfile({ targetAudience: exactAudience });
        }).not.toThrow();
      });
    });

    describe("industry", () => {
      it("should accept valid industry", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ industry: "SaaS" });
        }).not.toThrow();
      });

      it("should reject empty industry", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ industry: "" });
        }).toThrow("industry must be a non-empty string");
      });

      it("should reject industry exceeding 100 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const longIndustry = "a".repeat(101);
        
        expect(() => {
          setBrandProfile({ industry: longIndustry });
        }).toThrow("industry must be at most 100 characters");
      });

      it("should accept industry with exactly 100 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const exactIndustry = "a".repeat(100);
        
        expect(() => {
          setBrandProfile({ industry: exactIndustry });
        }).not.toThrow();
      });
    });

    describe("defaultCTA", () => {
      it("should accept valid defaultCTA", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ defaultCTA: "Learn more" });
        }).not.toThrow();
      });

      it("should reject empty defaultCTA", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        
        expect(() => {
          setBrandProfile({ defaultCTA: "" });
        }).toThrow("defaultCTA must be a non-empty string");
      });

      it("should reject defaultCTA exceeding 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const longCTA = "a".repeat(201);
        
        expect(() => {
          setBrandProfile({ defaultCTA: longCTA });
        }).toThrow("defaultCTA must be at most 200 characters");
      });

      it("should accept defaultCTA with exactly 200 characters", () => {
        const { setBrandProfile } = useAISettingsStore.getState();
        const exactCTA = "a".repeat(200);
        
        expect(() => {
          setBrandProfile({ defaultCTA: exactCTA });
        }).not.toThrow();
      });
    });
  });

  describe("validation error behavior (Requirement 4.11)", () => {
    it("should reject invalid updates and preserve existing valid data", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      // Set valid initial data
      setBrandProfile({
        brandName: "Valid Brand",
        tone: "professional",
      });
      
      const stateBefore = useAISettingsStore.getState();
      expect(stateBefore.brandProfile?.brandName).toBe("Valid Brand");
      expect(stateBefore.brandProfile?.tone).toBe("professional");
      
      // Try to update with invalid data
      expect(() => {
        setBrandProfile({ brandName: "" });
      }).toThrow();
      
      // Verify data was not changed
      const stateAfter = useAISettingsStore.getState();
      expect(stateAfter.brandProfile?.brandName).toBe("Valid Brand");
      expect(stateAfter.brandProfile?.tone).toBe("professional");
    });

    it("should return descriptive error messages", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      // Test various validation errors return correct messages
      expect(() => {
        setBrandProfile({ brandName: "" });
      }).toThrow("brandName must be a non-empty string");
      
      expect(() => {
        setBrandProfile({ tone: "a".repeat(51) });
      }).toThrow("tone must be at most 50 characters");
      
      expect(() => {
        setBrandProfile({ hashtags: ["invalid"] });
      }).toThrow('Each hashtag must be a string starting with "#"');
      
      expect(() => {
        setBrandProfile({ doList: Array(11).fill("item") });
      }).toThrow("doList must contain at most 10 items");
    });
  });

  describe("partial updates", () => {
    it("should allow updating individual fields without validating others", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      // Set initial profile
      setBrandProfile({
        brandName: "Brand",
        tone: "casual",
      });
      
      // Update only brandName
      expect(() => {
        setBrandProfile({ brandName: "Updated Brand" });
      }).not.toThrow();
      
      const state = useAISettingsStore.getState();
      expect(state.brandProfile?.brandName).toBe("Updated Brand");
      expect(state.brandProfile?.tone).toBe("casual");
    });

    it("should validate only the fields being updated", () => {
      const { setBrandProfile } = useAISettingsStore.getState();
      
      // Set initial profile with valid data
      setBrandProfile({
        brandName: "Brand",
        tone: "casual",
      });
      
      // Try to update with invalid tone
      expect(() => {
        setBrandProfile({ tone: "" });
      }).toThrow("tone must be a non-empty string");
      
      // Verify brandName was not affected
      const state = useAISettingsStore.getState();
      expect(state.brandProfile?.brandName).toBe("Brand");
    });
  });
});
