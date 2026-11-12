# Implementation Plan: AI Content Generator

## Overview

This implementation plan breaks down the AI Content Generator feature into discrete TypeScript coding tasks. The feature integrates AI-powered content generation into LateWiz using Groq (text), Pixabay (stock images), and Pollinations.ai (AI images). All external API calls are server-side via Next.js API routes, with client-side state management via Zustand and TanStack Query. Generated content flows through the existing compose and scheduling pipeline.

## Tasks

- [x] 1. Set up core types, interfaces, and utilities
  - Create `src/types/ai.ts` with all TypeScript interfaces from design (BrandProfile, GenerationPrefs, AutoScheduleConfig, ContentVariant, GeneratedPostDraft, DraftScheduledPost, ContentTheme, TrendingTopic, StockImage, PlatformConstraints)
  - Create `src/lib/ai/constants.ts` with platform limits (character counts, hashtag limits) and provider rate limits
  - Create `src/lib/ai/validation.ts` with Zod schemas for all request/response types
  - Set up environment variables in `.env.local` for GROQ_API_KEY and PIXABAY_API_KEY
  - _Requirements: 1.1, 2.1, 3.1, 11.1, 11.2, 14.1, 14.2, 14.3, 14.4_

- [ ] 2. Implement AI Settings Store (Zustand)
  - [~] 2.1 Create AI Settings Store with persistence
    - Create `src/stores/ai-settings-store.ts` implementing AISettingsState interface
    - Use Zustand `persist` middleware with localStorage key "latewiz-ai-settings"
    - Implement setBrandProfile, setGenerationPrefs, setAutoScheduleConfig actions with partial merge logic
    - Implement addGenerationHistory with prepend and 50-entry truncation
    - Implement clearGenerationHistory action
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 2.2 Write unit tests for AI Settings Store
    - Test partial updates preserve unmodified fields
    - Test generation history truncation at 50 entries
    - Test clearGenerationHistory empties the array
    - Test localStorage persistence and hydration
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [~] 2.3 Add BrandProfile validation to store
    - Validate brandName (non-empty, max 100 chars)
    - Validate tone (non-empty, max 50 chars)
    - Validate hashtags (each starts with "#", max 30 tags)
    - Validate doList and dontList (max 10 items, max 200 chars per item)
    - Validate description, voice, targetAudience, industry, defaultCTA (max lengths)
    - Reject updates with validation errors and return error message
    - _Requirements: 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [ ]* 2.4 Write property test for store merge behavior
    - **Property 10: Store Merge Behavior**
    - **Validates: Requirements 4.2, 4.3, 4.4**
    - Test that partial updates preserve all unmodified fields across random inputs

- [ ] 3. Implement prompt construction utilities
  - [~] 3.1 Create prompt builder functions
    - Create `src/lib/ai/prompts.ts`
    - Implement buildSystemPrompt(brand, platform) with brand context and platform constraints
    - Implement buildUserPrompt(topic, tone, constraints, numVariants) with JSON format instructions
    - Implement sanitizeUserInput() to remove control characters, null bytes, and instruction injection attempts
    - Ensure system prompt max 4000 chars, user prompt max 2000 chars
    - _Requirements: 7.4, 7.6, 7.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ]* 3.2 Write unit tests for prompt construction
    - Test buildSystemPrompt includes brand name, tone, voice, target audience, platform constraints, dontList
    - Test buildSystemPrompt does not exceed 4000 characters
    - Test buildUserPrompt includes topic, tone, constraints, variant count, JSON instructions
    - Test buildUserPrompt does not exceed 2000 characters
    - Test buildUserPrompt defaults numVariants to 3 when omitted
    - Test sanitizeUserInput removes control characters and injection attempts
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ]* 3.3 Write property test for system prompt construction
    - **Property 13: System Prompt Construction**
    - **Validates: Requirements 7.7, 12.1, 12.2, 12.3, 12.4**
    - Test that buildSystemPrompt always returns non-empty string under 4000 chars with brand context

  - [ ]* 3.4 Write property test for user prompt construction
    - **Property 14: User Prompt Construction**
    - **Validates: Requirements 12.5, 12.6, 12.7**
    - Test that buildUserPrompt always returns non-empty string under 2000 chars with all required elements

- [ ] 4. Implement platform validation utilities
  - [~] 4.1 Create platform constraint functions
    - Create `src/lib/ai/platform-validation.ts`
    - Implement getPlatformConstraints(platform) returning PlatformConstraints
    - Implement checkPlatformLimits(content, platform) returning boolean (true if within limit)
    - Implement validateHashtags(hashtags, platform) returning sanitized string array
    - Implement generateWarnings(variant, platform) returning string array of violations
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 4.2 Write unit tests for platform validation
    - Test checkPlatformLimits for all platforms at, below, and above limits
    - Test validateHashtags ensures tags start with "#", removes empty tags, enforces platform max
    - Test validateHashtags does not mutate input array
    - Test generateWarnings populates violations correctly
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 4.3 Write property test for hashtag validation
    - **Property 3: Hashtag Validation**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
    - Test that validateHashtags always returns valid tags within platform limits and never mutates input

  - [ ]* 4.4 Write property test for content validation consistency
    - **Property 2: Content Variant Validity (partial)**
    - **Validates: Requirements 11.6, 11.7**
    - Test that checkPlatformLimits returns true iff content length <= platform limit

- [ ] 5. Implement rate limiting system
  - [~] 5.1 Create rate limiter with in-memory cache
    - Create `src/lib/ai/rate-limiter.ts`
    - Implement checkRateLimit(provider, identifier) with Map-based counting
    - Enforce limits: groq=30/60s, pixabay=100/60s, pollinations=10/60s
    - Namespace keys as "ratelimit:{provider}:{identifier}"
    - Reset count when 60-second window expires
    - Return true if allowed, false if exceeded
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 5.2 Write unit tests for rate limiter
    - Test checkRateLimit allows exactly the limit count within window
    - Test checkRateLimit rejects requests beyond limit
    - Test window reset after 60 seconds
    - Test proper namespacing by provider and identifier
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6_

  - [ ]* 5.3 Write property test for rate limit enforcement
    - **Property 5: Rate Limit Enforcement**
    - **Validates: Requirements 8.1, 8.2, 8.4, 8.5, 8.6**
    - Test that rate limiter never allows exceeding the provider-specific limit

- [ ] 6. Implement JSON parsing and fallback utilities
  - [~] 6.1 Create JSON parsing functions
    - Create `src/lib/ai/json-parser.ts`
    - Implement parseJSON(content) extracting JSON from text or markdown code blocks
    - Implement extractContentFallback(content) producing ContentVariant array from raw text
    - Implement extractTopicsFallback(content) producing TrendingTopic array from raw text
    - Return null from parseJSON if parsing fails
    - Ensure fallback functions always produce at least one item from non-empty input
    - _Requirements: 1.4, 1.5, 5.4, 9.8, 9.9_

  - [ ]* 6.2 Write unit tests for JSON parsing
    - Test parseJSON with valid JSON, JSON in markdown code blocks, malformed JSON, empty strings
    - Test extractContentFallback produces at least one variant from raw text
    - Test extractTopicsFallback produces at least one topic from raw text
    - _Requirements: 1.4, 1.5, 5.4, 9.8, 9.9_

  - [ ]* 6.3 Write property test for JSON parsing and fallback
    - **Property 4: JSON Parsing and Fallback Extraction**
    - **Validates: Requirements 1.4, 1.5, 9.8, 9.9**
    - Test that parseJSON or fallback always produces valid output from Groq-like responses

- [~] 7. Checkpoint - Core utilities complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Content Generation API Route
  - [~] 8.1 Create /api/ai/generate-content route
    - Create `src/app/api/ai/generate-content/route.ts`
    - Validate input with Zod schema (topic, platform, tone, brandContext, numVariants)
    - Check rate limit for "groq" provider using IP from x-forwarded-for
    - Build system and user prompts using prompt utilities
    - Call Groq API (llama-3.3-70b-versatile) with temperature 0.7, max_tokens 1024
    - Parse response with parseJSON, fallback to extractContentFallback
    - Build ContentVariant array with id, content, hashtags, imageSuggestion, callToAction, characterCount, platformValid, warnings
    - Return HTTP 400 for validation errors, HTTP 429 for rate limits, HTTP 502 for Groq failures
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 7.1, 7.2, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3_

  - [ ]* 8.2 Write integration test for content generation route
    - Mock Groq API responses (valid JSON, malformed JSON, error)
    - Test route returns valid ContentVariant array
    - Test rate limiting returns HTTP 429
    - Test API key is never in response
    - _Requirements: 1.1, 1.2, 1.3, 1.9, 8.3_

  - [ ]* 8.3 Write property test for API key isolation
    - **Property 1: API Key Isolation (partial)**
    - **Validates: Requirements 1.9, 7.1, 7.2, 7.3**
    - Test that content generation response never contains GROQ_API_KEY

  - [ ]* 8.4 Write property test for content variant validity
    - **Property 2: Content Variant Validity**
    - **Validates: Requirements 1.2, 1.3, 1.6, 1.7, 1.8, 11.1, 11.6, 11.7**
    - Test that response always contains valid ContentVariants with correct fields

- [ ] 9. Implement Image Search API Route
  - [~] 9.1 Create /api/ai/search-images route
    - Create `src/app/api/ai/search-images/route.ts`
    - Validate query (non-empty, max 100 chars) and perPage (1-200)
    - Check rate limit for "pixabay" provider
    - Sanitize query by URL-encoding and removing control characters
    - Build Pixabay API URL with safesearch=true, orientation=horizontal, image_type=photo
    - Parse response and normalize to StockImage array (id, url, previewUrl, tags, width, height, source="pixabay")
    - Return HTTP 400 for validation errors, HTTP 429 for rate limits, HTTP 500 for missing API key, HTTP 502 for Pixabay failures
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 9.2 Write integration test for image search route
    - Mock Pixabay API responses
    - Test route returns StockImage array
    - Test safesearch and orientation parameters are included
    - Test API key is never in response
    - Test invalid query returns HTTP 400
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.7_

  - [ ]* 9.3 Write property test for Pixabay URL construction
    - **Property 16: Pixabay URL Construction and Query Sanitization**
    - **Validates: Requirements 2.1, 2.6**
    - Test that Pixabay URL always includes safesearch=true and sanitized query

  - [ ]* 9.4 Write property test for stock image normalization
    - **Property 17: StockImage Normalization**
    - **Validates: Requirements 2.2, 2.3**
    - Test that normalized StockImage objects always have required fields and source="pixabay"

- [ ] 10. Implement AI Image Generation API Route
  - [~] 10.1 Create /api/ai/generate-image route
    - Create `src/app/api/ai/generate-image/route.ts`
    - Validate prompt (non-empty, max 500 chars), width (256-2048, default 1024), height (256-2048, default 1024), model ("flux" or "turbo", default "flux")
    - Check rate limit for "pollinations" provider
    - Build Pollinations URL with encoded prompt, width, height, model, nologo=true
    - Fetch image from Pollinations with 60-second timeout
    - Get presigned URL from Zernio via getMediaPresignedUrl
    - Upload image binary to presigned URL with Content-Type: image/jpeg
    - Return response with Zernio publicUrl, type="image", width, height
    - Return HTTP 400 for validation errors, HTTP 429 for rate limits, HTTP 502 for Pollinations failures, HTTP 500 for upload failures
    - Never expose Pollinations URL or API keys in response
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ]* 10.2 Write integration test for AI image generation route
    - Mock Pollinations API and Zernio presigned URL
    - Test image upload flow end-to-end
    - Test defaults for width, height, model
    - Test Pollinations URL is never in response
    - Test invalid dimensions return HTTP 400
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ]* 10.3 Write property test for Pollinations URL construction
    - **Property 18: Pollinations URL Construction with Defaults**
    - **Validates: Requirements 3.1, 3.7, 3.8**
    - Test that Pollinations URL includes encoded prompt and defaults for omitted params

  - [ ]* 10.4 Write property test for AI image response safety
    - **Property 19: AI Image Response Safety**
    - **Validates: Requirements 3.4, 3.6**
    - Test that response never contains Pollinations URL or API keys

- [ ] 11. Implement Trending Topics API Route
  - [~] 11.1 Create /api/ai/trending-topics route
    - Create `src/app/api/ai/trending-topics/route.ts`
    - Validate niche (non-empty, max 200 chars)
    - Check rate limit for "groq" provider
    - Build system prompt for trend analysis
    - Build user prompt with niche, and brand name/audience/industry if brandContext provided
    - Call Groq API (llama-3.3-70b-versatile) with temperature 0.8, max_tokens 2048
    - Parse response with parseJSON, fallback to extractTopicsFallback
    - Build TrendingTopic array (max 10) with id, topic, angle, whyItTrends, contentIdeas (max 5)
    - Return HTTP 400 for validation errors, HTTP 429 for rate limits, HTTP 502 for Groq failures
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8_

  - [ ]* 11.2 Write integration test for trending topics route
    - Mock Groq API responses
    - Test route returns TrendingTopic array
    - Test brandContext is included in prompt when provided
    - Test API key is never in response
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [ ]* 11.3 Write property test for trending topics structure
    - **Property 20: Trending Topics Structure and Fallback**
    - **Validates: Requirements 5.2, 5.4**
    - Test that response always contains valid TrendingTopic objects

  - [ ]* 11.4 Write property test for trending prompt construction
    - **Property 21: Trending Prompt Construction**
    - **Validates: Requirements 5.1, 5.3**
    - Test that prompt includes niche and brand context when provided

- [ ] 12. Implement Auto-Schedule API Route
  - [~] 12.1 Create weighted theme selection utility
    - Create `src/lib/ai/theme-selector.ts`
    - Implement selectWeightedTheme(themes, index) using weighted distribution
    - Ensure selection proportional to theme weights over large samples
    - _Requirements: 6.2_

  - [ ]* 12.2 Write property test for weighted theme distribution
    - **Property 8: Weighted Theme Distribution**
    - **Validates: Requirements 6.2**
    - Test that selectWeightedTheme distributes according to weights over 10000 calls

  - [~] 12.3 Create /api/ai/auto-schedule route
    - Create `src/app/api/ai/auto-schedule/route.ts`
    - Validate config (enabled, postsPerWeek 1-14, postingTimes max 7, contentThemes non-empty, theme weights sum to 1.0)
    - Calculate schedule slots based on frequency, postsPerWeek, postingTimes, date range
    - For each slot: select theme using selectWeightedTheme, call Content_Generation_Route, call Image_Search_Route
    - Build DraftScheduledPost array with content, hashtags, mediaUrls, platforms, scheduledFor (ISO future timestamp), topic, status="draft"
    - Space content generation requests at least 2 seconds apart
    - Return HTTP 400 for validation errors (including weight sum != 1.0)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.10, 6.11, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 15.5_

  - [ ]* 12.4 Write integration test for auto-schedule route
    - Mock content generation and image search
    - Test slot calculation matches expected count
    - Test all drafts have status="draft"
    - Test all scheduledFor timestamps are in the future
    - Test theme weight validation rejects sum != 1.0
    - _Requirements: 6.1, 6.5, 6.6, 6.7, 6.10, 6.11_

  - [ ]* 12.5 Write property test for draft safety
    - **Property 6: Draft Safety**
    - **Validates: Requirements 6.6, 6.7**
    - Test that auto-schedule never produces non-draft status

  - [ ]* 12.6 Write property test for draft timestamp validity
    - **Property 7: Draft Timestamp Validity**
    - **Validates: Requirements 6.10**
    - Test that all scheduledFor timestamps are valid ISO strings in the future

  - [ ]* 12.7 Write property test for theme weight validation
    - **Property 9: Theme Weight Validation**
    - **Validates: Requirements 6.11, 13.4**
    - Test that system rejects configs where theme weights don't sum to 1.0

  - [ ]* 12.8 Write property test for schedule slot calculation
    - **Property 22: Schedule Slot Calculation**
    - **Validates: Requirements 6.1**
    - Test that slot count matches expected count from config

- [~] 13. Checkpoint - Server routes complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement AI Hooks (TanStack Query)
  - [~] 14.1 Create AI hooks
    - Create `src/hooks/use-ai.ts`
    - Implement useGenerateContent() mutation hook wrapping /api/ai/generate-content
    - Implement useSearchImages() mutation hook wrapping /api/ai/search-images with 5-minute cache
    - Implement useGenerateImage() mutation hook wrapping /api/ai/generate-image
    - Implement useTrendingTopics() mutation hook wrapping /api/ai/trending-topics with 1-hour cache
    - Implement useAutoSchedule() mutation hook wrapping /api/ai/auto-schedule
    - Add retry logic: Groq retries 2x with exponential backoff, Pixabay retries 1x, Pollinations retries 1x
    - Fallback providers: Groq → Gemini, Pixabay → Unsplash, Pollinations → alternate model
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 6.1, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 15.6_

  - [ ]* 14.2 Write unit tests for AI hooks
    - Test useGenerateContent calls correct endpoint and handles loading/error states
    - Test useSearchImages caching with 5-minute stale time
    - Test useTrendingTopics caching with 1-hour stale time
    - Test retry logic for each hook
    - _Requirements: 5.6, 9.1, 9.2, 15.6_

- [ ] 15. Implement AI Generator Page UI
  - [~] 15.1 Create Brand Configuration Panel
    - Create `src/app/dashboard/ai-generator/_components/brand-config-panel.tsx`
    - Form fields for brandName, description, tone, voice, targetAudience, industry, defaultCTA
    - Multi-input for hashtags (starts with "#", max 30)
    - Multi-input for doList and dontList (max 10 each, max 200 chars per item)
    - Save button calls setBrandProfile from AI Settings Store
    - Display validation errors inline
    - _Requirements: 4.1, 4.2, 4.7, 4.8, 4.9, 4.10, 4.12_

  - [~] 15.2 Create Content Generation Panel
    - Create `src/app/dashboard/ai-generator/_components/content-generation-panel.tsx`
    - Input for topic (max 500 chars)
    - Dropdown for platform selection
    - Input for tone override (optional)
    - Slider for numVariants (1-5)
    - Generate button calls useGenerateContent
    - Display loading state during generation
    - Display ContentVariant cards with content, hashtags, imageSuggestion, callToAction
    - Show characterCount, platformValid, and warnings for each variant
    - Select button navigates to compose page with prefilled content
    - _Requirements: 1.1, 1.2, 1.3, 10.1, 10.2, 10.6, 10.7_

  - [~] 15.3 Create Image Gallery Panel
    - Create `src/app/dashboard/ai-generator/_components/image-gallery-panel.tsx`
    - Search input for royalty-free image query
    - Button to generate AI image from prompt
    - Display StockImage grid with previewUrl, tags, dimensions
    - Display AI-generated image with loading state (60s timeout)
    - Select button attaches image to pending AI post
    - Show error states with retry button
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 9.4, 9.5, 9.6_

  - [~] 15.4 Create Trending Topics Panel
    - Create `src/app/dashboard/ai-generator/_components/trending-topics-panel.tsx`
    - Input for niche (max 200 chars)
    - Button calls useTrendingTopics
    - Display TrendingTopic cards with topic, angle, whyItTrends, contentIdeas
    - Select button triggers content generation flow with topic as input
    - _Requirements: 5.1, 5.2_

  - [~] 15.5 Create Review Queue Panel
    - Create `src/app/dashboard/ai-generator/_components/review-queue-panel.tsx`
    - Display DraftScheduledPost cards with content, hashtags, mediaUrls, scheduledFor
    - Edit button allows inline content/hashtag/media editing
    - Approve button calls createPost mutation with draft data
    - Discard button removes draft from queue
    - Show platform-specific previews using existing PlatformPreviews component
    - Track status transitions: draft → approved → scheduled, draft → discarded
    - _Requirements: 6.8, 6.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 15.1, 15.2, 15.3_

  - [~] 15.6 Create main AI Generator Page
    - Create `src/app/dashboard/ai-generator/page.tsx`
    - Layout with tabs: Brand Config, Generate, Images, Trending, Auto-Schedule, Review Queue
    - Integrate all sub-panels
    - Show real-time loading states during AI operations
    - Display error messages with retry buttons for API failures
    - Prompt user to configure brand settings if BrandProfile is empty (allow skip)
    - _Requirements: 9.10, 10.7_

  - [~] 15.7 Create Auto-Schedule Configuration Panel
    - Create `src/app/dashboard/ai-generator/_components/auto-schedule-config-panel.tsx`
    - Form for AutoScheduleConfig (frequency, postsPerWeek, postingTimes, contentThemes, startDate, endDate)
    - ContentTheme editor with name, description, weight inputs (ensure weights sum to 1.0)
    - Save button calls setAutoScheduleConfig from AI Settings Store
    - Start button calls useAutoSchedule and displays drafts in Review Queue
    - Display validation errors (postsPerWeek 1-14, max 7 postingTimes, weights sum to 1.0, dates valid)
    - Show per-post progress during batch generation
    - _Requirements: 6.1, 6.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [ ] 16. Integrate with existing Compose Pipeline
  - [~] 16.1 Update Compose page for AI prefill
    - Modify `src/app/dashboard/compose/page.tsx` to accept prefilled content from URL params or navigation state
    - Prefill content, hashtags, and imageSuggestion when navigating from AI Generator
    - Ensure MediaItem and PlatformPost types conform to existing types
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [~] 16.2 Wire Review Queue to createPost
    - In Review Queue, on approve, call createPost mutation with GeneratedPostDraft data
    - Transform DraftScheduledPost to CreatePostInput format
    - Ensure mediaItems conform to MediaItem type, platforms conform to PlatformPost type
    - Handle success/error states with toast notifications
    - _Requirements: 15.1, 15.2, 15.3_

- [ ] 17. Add navigation and routing
  - [~] 17.1 Add AI Generator to dashboard navigation
    - Update dashboard layout navigation with link to /dashboard/ai-generator
    - Add icon for AI Generator (Sparkles or Wand from lucide-react)
    - _Requirements: 10.1_

  - [~] 17.2 Create route and page
    - Ensure `src/app/dashboard/ai-generator/page.tsx` is created and accessible
    - Test navigation from dashboard to AI Generator page
    - _Requirements: 10.1_

- [ ] 18. Implement error handling and fallback UI
  - [~] 18.1 Add error boundaries
    - Wrap AI Generator page in ErrorBoundary component
    - Display user-friendly error messages for API failures
    - Show retry buttons for transient errors
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [~] 18.2 Add rate limit UI feedback
    - Display countdown timer when rate limit is hit
    - Show remaining request count when available
    - Disable generate buttons when rate limit approached (25/30 for Groq)
    - _Requirements: 8.3_

  - [~] 18.3 Add fallback provider logic
    - Implement Gemini API fallback in useGenerateContent hook
    - Implement Unsplash API fallback in useSearchImages hook
    - Implement alternate model fallback in useGenerateImage hook
    - Display fallback option to user when both providers fail
    - Maintain same interface contract for fallback providers
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6, 9.11_

- [ ] 19. Add input sanitization and security
  - [~] 19.1 Implement prompt injection prevention
    - In prompt builder, sanitize all user-provided text
    - Remove control characters, null bytes, instruction override attempts
    - Ensure system prompt always prepended before user input
    - Include dontList in system prompt to avoid prohibited topics
    - _Requirements: 7.4, 7.5, 7.6, 7.7_

  - [ ]* 19.2 Write property test for input sanitization
    - **Property 15: Input Sanitization**
    - **Validates: Requirements 7.4, 7.6**
    - Test that sanitized text contains no control chars, null bytes, or injection attempts

  - [~] 19.3 Verify API keys never exposed
    - Audit all server routes to ensure GROQ_API_KEY and PIXABAY_API_KEY never in response
    - Audit error messages to ensure no API key echoing
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 19.4 Write property test for API key isolation (comprehensive)
    - **Property 1: API Key Isolation**
    - **Validates: Requirements 1.9, 2.5, 3.6, 5.5, 7.1, 7.2, 7.3**
    - Test that all AI routes never expose API keys in any response or error

- [ ] 20. Implement configuration validation
  - [~] 20.1 Add Zod schemas for configuration
    - Create schemas for AutoScheduleConfig validation
    - Create schemas for GenerationPrefs validation
    - Validate postsPerWeek (1-14), postingTimes (HH:MM, max 7), contentThemes (non-empty if enabled)
    - Validate theme weights sum to 1.0
    - Validate startDate (today or future), endDate (after startDate)
    - Validate temperature (0.0-1.0), maxTokens (256-4096), numVariants (1-5), defaultModel
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 14.1, 14.2, 14.3, 14.4_

  - [~] 20.2 Add client-side validation
    - In Auto-Schedule Config Panel, validate fields before submission
    - Display field-level error messages
    - Prevent submission if validation fails
    - _Requirements: 13.7_

  - [ ]* 20.3 Write property test for configuration validation
    - **Property 25: Configuration Validation**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.5, 13.6, 14.1, 14.2, 14.3, 14.4**
    - Test that all config inputs are validated with correct ranges

- [ ] 21. Add status transition management
  - [~] 21.1 Implement status transition logic
    - In Review Queue, enforce status transitions: draft → approved → scheduled, draft → discarded
    - Prevent invalid transitions
    - _Requirements: 10.4_

  - [ ]* 21.2 Write property test for status transition integrity
    - **Property 24: Status Transition Integrity**
    - **Validates: Requirements 10.4**
    - Test that status only transitions through allowed sequences

- [ ] 22. Add data type conformance for existing pipeline
  - [~] 22.1 Verify MediaItem conformance
    - Ensure AI-generated posts use existing MediaItem type (type, url, width, height, duration)
    - Test that mediaItems from AI routes conform to type
    - _Requirements: 15.2_

  - [~] 22.2 Verify PlatformPost conformance
    - Ensure AI-generated posts use existing PlatformPost type (platform, accountId, customContent, platformSpecificData)
    - Test that platforms from AI routes conform to type
    - _Requirements: 15.3_

  - [ ]* 22.3 Write property test for data type conformance
    - **Property 27: Data Type Conformance**
    - **Validates: Requirements 15.2, 15.3**
    - Test that AI-generated posts conform to existing MediaItem and PlatformPost types

- [~] 23. Final checkpoint - End-to-end testing
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 24. Integration testing and bug fixes
  - [~] 24.1 Test full workflow: Brand Config → Generate → Images → Review → Schedule
    - Configure brand profile
    - Generate content variants
    - Search and select images
    - Review and approve draft
    - Verify post scheduled via createPost
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 15.1, 15.4_

  - [~] 24.2 Test auto-schedule workflow
    - Configure auto-schedule with themes
    - Generate batch of drafts
    - Review drafts in queue
    - Approve and schedule multiple posts
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.8, 6.9_

  - [~] 24.3 Test error scenarios
    - Test Groq API failure with fallback to Gemini
    - Test Pixabay API failure with fallback to Unsplash
    - Test Pollinations failure with model fallback
    - Test rate limit UI feedback
    - Test malformed JSON parsing with fallback extraction
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.8, 9.9_

  - [~] 24.4 Test security measures
    - Verify API keys never exposed in any response
    - Verify prompt injection attempts are sanitized
    - Verify rate limiting prevents abuse
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 8.1, 8.2_

  - [~] 24.5 Fix any bugs discovered during testing
    - Address edge cases
    - Fix validation issues
    - Improve error messages

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit tests and integration tests validate specific examples and edge cases
- The design uses TypeScript throughout, matching the existing Next.js codebase
- All external API calls are server-side via Next.js API routes (App Router)
- Generated content flows through existing compose pipeline (createPost, MediaItem, PlatformPost)
- Rate limiting prevents free-tier API quota exhaustion
- Fallback providers ensure resilience (Groq → Gemini, Pixabay → Unsplash)
- User review and approval required before any AI-generated post is published

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1", "6.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "4.2", "5.2", "6.2"] },
    { "id": 3, "tasks": ["2.4", "3.3", "3.4", "4.3", "4.4", "5.3", "6.3"] },
    { "id": 4, "tasks": ["8.1", "9.1", "10.1", "11.1", "12.1"] },
    { "id": 5, "tasks": ["8.2", "9.2", "10.2", "11.2", "12.2", "12.3"] },
    { "id": 6, "tasks": ["8.3", "8.4", "9.3", "9.4", "10.3", "10.4", "11.3", "11.4", "12.4"] },
    { "id": 7, "tasks": ["12.5", "12.6", "12.7", "12.8"] },
    { "id": 8, "tasks": ["14.1"] },
    { "id": 9, "tasks": ["14.2", "15.1", "15.2", "15.3", "15.4"] },
    { "id": 10, "tasks": ["15.5", "15.7", "16.1"] },
    { "id": 11, "tasks": ["15.6", "16.2", "17.1"] },
    { "id": 12, "tasks": ["17.2", "18.1", "19.1", "20.1", "21.1", "22.1", "22.2"] },
    { "id": 13, "tasks": ["18.2", "18.3", "19.2", "19.3", "20.2", "21.2", "22.3"] },
    { "id": 14, "tasks": ["19.4", "20.3"] },
    { "id": 15, "tasks": ["24.1", "24.2"] },
    { "id": 16, "tasks": ["24.3", "24.4"] },
    { "id": 17, "tasks": ["24.5"] }
  ]
}
```
