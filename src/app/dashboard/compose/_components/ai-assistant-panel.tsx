"use client";

/**
 * AI Assistant Panel
 *
 * Features:
 * - Streaming content generation via Groq (SSE)
 * - Fallback model on 429/503 (handled server-side)
 * - Image search via Pixabay with 5-min client cache (TanStack Query)
 * - Image generation via Pollinations (free, no key)
 * - Rate-limit feedback (Retry-After header shown to user)
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Search,
  Image as ImageIcon,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Wand2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { CACHE_DURATIONS, CACHE_KEYS } from "@/lib/ai/constants";
import type { ContentVariant, StockImage } from "@/types/ai";
import type { Platform } from "@/lib/late-api";

// ─── types ───────────────────────────────────────────────────────────────────

interface AIPanelProps {
  platform: Platform;
  onUseVariant: (content: string, hashtags: string[]) => void;
  onAddMedia?: (url: string) => void;
}

interface BrandContext {
  brandName: string;
  description: string;
  tone: string;
  voice: string;
  targetAudience: string;
  industry: string;
  hashtags: string[];
  doList: string[];
  dontList: string[];
  defaultCTA: string;
}

const DEFAULT_BRAND: BrandContext = {
  brandName: "My Brand",
  description: "A social media presence",
  tone: "professional",
  voice: "approachable",
  targetAudience: "general audience",
  industry: "general",
  hashtags: [],
  doList: [],
  dontList: [],
  defaultCTA: "Learn more",
};

// ─── image search hook with 5-min cache ──────────────────────────────────────

function useImageSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: [CACHE_KEYS.imageSearch, query],
    queryFn: async (): Promise<StockImage[]> => {
      const res = await fetch(
        `/api/ai/search-images?q=${encodeURIComponent(query)}&per_page=12`
      );
      if (!res.ok) {
        const retryAfter = res.headers.get("Retry-After");
        if (res.status === 429) {
          throw new Error(
            `Rate limited. Try again in ${retryAfter ?? "60"}s.`
          );
        }
        throw new Error("Image search failed.");
      }
      const data = await res.json();
      return data.images as StockImage[];
    },
    enabled: enabled && query.trim().length > 0,
    staleTime: CACHE_DURATIONS.imageSearch,   // ← 5-min cache wired
    gcTime: CACHE_DURATIONS.imageSearch * 2,
    retry: false,
  });
}

// ─── image generation hook ───────────────────────────────────────────────────

function useGenerateImage(prompt: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ai-gen-image", prompt],
    queryFn: async (): Promise<string> => {
      const res = await fetch(
        `/api/ai/generate-image?prompt=${encodeURIComponent(prompt)}&width=1024&height=1024&model=flux`
      );
      if (!res.ok) {
        const retryAfter = res.headers.get("Retry-After");
        if (res.status === 429) {
          throw new Error(
            `Rate limited. Try again in ${retryAfter ?? "60"}s.`
          );
        }
        throw new Error("Image generation failed.");
      }
      const data = await res.json();
      return data.url as string;
    },
    enabled: enabled && prompt.trim().length > 0,
    staleTime: 10 * 60 * 1000, // 10 min — generated images don't change
    gcTime: 20 * 60 * 1000,
    retry: false,
  });
}

// ─── streaming content generation ────────────────────────────────────────────

function useStreamGenerate() {
  const [variants, setVariants] = useState<ContentVariant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (
      topic: string,
      platform: Platform,
      brandContext: BrandContext,
      numVariants: number
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setVariants([]);
      setError(null);

      try {
        // Non-streaming endpoint — reasoning model emits nothing until done,
        // so streaming adds no UX benefit and complicates parsing.
        const res = await fetch("/api/ai/generate-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, platform, brandContext, numVariants }),
          signal: controller.signal,
        });

        const retryAfter = res.headers.get("Retry-After");
        if (res.status === 429) {
          setError(`Rate limited. Try again in ${retryAfter ?? "60"}s.`);
          return;
        }

        if (!res.ok) {
          let msg = "Generation failed.";
          try { const b = await res.json(); msg = b?.message ?? b?.error ?? msg; } catch { /* ignore */ }
          setError(msg);
          return;
        }

        const data = await res.json();
        const parsed: ContentVariant[] = data?.variants ?? [];

        if (parsed.length === 0) {
          setError("No variants returned. Try a different topic.");
          return;
        }

        setVariants(parsed);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message ?? "Generation failed.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { variants, isStreaming: isLoading, error, generate };
}

// ─── copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── variant card ─────────────────────────────────────────────────────────────

function VariantCard({
  variant,
  onUse,
}: {
  variant: ContentVariant;
  onUse: (content: string, hashtags: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = variant.content.slice(0, 120);
  const needsExpand = variant.content.length > 120;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="text-sm text-foreground leading-relaxed">
        {expanded || !needsExpand ? variant.content : `${preview}…`}
        {needsExpand && (
          <button
            className="ml-1 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />}
          </button>
        )}
      </div>

      {variant.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {variant.hashtags.slice(0, 8).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {variant.hashtags.length > 8 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              +{variant.hashtags.length - 8}
            </Badge>
          )}
        </div>
      )}

      {variant.warnings.length > 0 && (
        <p className="text-xs text-yellow-500">{variant.warnings[0]}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">{variant.characterCount} chars</span>
        <div className="flex items-center gap-2">
          <CopyButton text={variant.content} />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => onUse(variant.content, variant.hashtags)}
          >
            Use
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── image card ──────────────────────────────────────────────────────────────

function ImageCard({ image, onSelect }: { image: StockImage; onSelect: (url: string) => void }) {
  return (
    <button
      className="relative overflow-hidden rounded-md aspect-video bg-muted hover:ring-2 hover:ring-primary transition-all group"
      onClick={() => onSelect(image.url)}
      title={image.tags.slice(0, 3).join(", ")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.previewUrl}
        alt={image.tags[0] ?? "stock image"}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-white text-xs font-medium">Use</span>
      </div>
    </button>
  );
}

// ─── main panel ──────────────────────────────────────────────────────────────

export function AIAssistantPanel({ platform, onUseVariant, onAddMedia }: AIPanelProps) {
  const queryClient = useQueryClient();

  // Content gen state
  const [topic, setTopic] = useState("");
  const [numVariants, setNumVariants] = useState(3);
  const { variants, isStreaming, error: genError, generate } = useStreamGenerate();

  // Image search state
  const [imageQuery, setImageQuery] = useState("");
  const [committedImageQuery, setCommittedImageQuery] = useState("");
  const { data: searchImages, isFetching: searchLoading, error: searchError } = useImageSearch(
    committedImageQuery,
    true
  );

  // Image gen state
  const [genPrompt, setGenPrompt] = useState("");
  const [committedGenPrompt, setCommittedGenPrompt] = useState("");
  const { data: generatedImageUrl, isFetching: genImageLoading, error: genImageError } = useGenerateImage(
    committedGenPrompt,
    true
  );

  const handleGenerate = () => {
    if (!topic.trim()) return;
    generate(topic, platform, DEFAULT_BRAND, numVariants);
  };

  const handleImageSearch = () => {
    if (!imageQuery.trim()) return;
    // Invalidate cache for a fresh fetch if same query
    queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.imageSearch, imageQuery] });
    setCommittedImageQuery(imageQuery);
  };

  const handleGenImage = () => {
    if (!genPrompt.trim()) return;
    queryClient.invalidateQueries({ queryKey: ["ai-gen-image", genPrompt] });
    setCommittedGenPrompt(genPrompt);
  };

  const displayVariants = variants;

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI Assistant</span>
        <Badge variant="secondary" className="text-xs ml-auto">Free</Badge>
      </div>

      <Tabs defaultValue="write" className="w-full">
        <TabsList className="w-full rounded-none border-b border-border bg-transparent h-9 p-0">
          <TabsTrigger value="write" className="flex-1 rounded-none text-xs h-9 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            <Wand2 className="h-3 w-3 mr-1" /> Write
          </TabsTrigger>
          <TabsTrigger value="images" className="flex-1 rounded-none text-xs h-9 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            <Search className="h-3 w-3 mr-1" /> Find Image
          </TabsTrigger>
          <TabsTrigger value="generate-image" className="flex-1 rounded-none text-xs h-9 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            <ImageIcon className="h-3 w-3 mr-1" /> Generate
          </TabsTrigger>
        </TabsList>

        {/* ── Write tab ── */}
        <TabsContent value="write" className="p-4 space-y-3 mt-0">
          <div className="space-y-2">
            <Textarea
              placeholder={`What's this post about? e.g. "new product launch for summer sale"`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Variants:</label>
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumVariants(n)}
                    className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                      numVariants === n
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={handleGenerate}
                  disabled={isStreaming || !topic.trim()}
                >
                  {isStreaming ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Writing…</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" /> Generate</>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {genError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">{genError}</p>
          )}

          {displayVariants.length > 0 && (
            <ScrollArea className="max-h-72">
              <div className="space-y-2 pr-1">
                {displayVariants.map((v) => (
                  <VariantCard
                    key={v.id}
                    variant={v}
                    onUse={(content, hashtags) => {
                      onUseVariant(content, hashtags);
                      toast.success("Content copied to editor.");
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          {displayVariants.length === 0 && !isStreaming && !genError && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Describe your post and hit Generate.
              <br />
              <span className="opacity-60">Ctrl+Enter to generate quickly.</span>
            </p>
          )}
        </TabsContent>

        {/* ── Find Image tab ── */}
        <TabsContent value="images" className="p-4 space-y-3 mt-0">
          <div className="flex gap-2">
            <Input
              placeholder="Search stock photos…"
              value={imageQuery}
              onChange={(e) => setImageQuery(e.target.value)}
              className="text-sm h-8"
              onKeyDown={(e) => { if (e.key === "Enter") handleImageSearch(); }}
            />
            <Button size="sm" className="h-8 px-3" onClick={handleImageSearch} disabled={searchLoading || !imageQuery.trim()}>
              {searchLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            </Button>
          </div>

          {searchError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
              {(searchError as Error).message}
            </p>
          )}

          {searchImages && searchImages.length > 0 && (
            <ScrollArea className="max-h-72">
              <div className="grid grid-cols-3 gap-1.5 pr-1">
                {searchImages.map((img) => (
                  <ImageCard
                    key={img.id}
                    image={img}
                    onSelect={(url) => {
                      if (onAddMedia) {
                        onAddMedia(url);
                        toast.success("Image added to post.");
                      } else {
                        navigator.clipboard.writeText(url);
                        toast.success("Image URL copied.");
                      }
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          {committedImageQuery && !searchLoading && (!searchImages || searchImages.length === 0) && !searchError && (
            <p className="text-xs text-muted-foreground text-center py-4">No images found. Try different keywords.</p>
          )}

          {!committedImageQuery && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Powered by Pixabay. Results cached for 5 minutes.
            </p>
          )}
        </TabsContent>

        {/* ── Generate Image tab ── */}
        <TabsContent value="generate-image" className="p-4 space-y-3 mt-0">
          <div className="space-y-2">
            <Textarea
              placeholder={`Describe the image… e.g. "minimalist flat lay of coffee and laptop, warm tones"`}
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenImage(); }}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Powered by Pollinations · Free · No key needed</span>
              <Button
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={handleGenImage}
                disabled={genImageLoading || !genPrompt.trim()}
              >
                {genImageLoading ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating…</>
                ) : (
                  <><Wand2 className="h-3 w-3 mr-1" /> Generate</>
                )}
              </Button>
            </div>
          </div>

          {genImageError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">
              {(genImageError as Error).message}
            </p>
          )}

          {generatedImageUrl && !genImageLoading && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImageUrl}
                alt="AI generated"
                className="w-full rounded-lg object-cover aspect-square"
                loading="lazy"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-xs"
                  onClick={() => { navigator.clipboard.writeText(generatedImageUrl); toast.success("Image URL copied."); }}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy URL
                </Button>
                {onAddMedia && (
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => { onAddMedia(generatedImageUrl); toast.success("Image added to post."); }}
                  >
                    <ImageIcon className="h-3 w-3 mr-1" /> Use in Post
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={handleGenImage}
                  title="Regenerate"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {!committedGenPrompt && !genImageLoading && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Describe the image you need and hit Generate.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
