"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCreateCalendarEntry } from "@/hooks/use-calendar-entries";
import { useBrands } from "@/hooks/use-brands";
import { useAccounts } from "@/hooks/use-accounts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { getPlatformName } from "@/lib/late-api/types";
import type { SavedBrand } from "@/types/brand";

interface ContentVariant {
  id: string;
  content: string;
  hashtags: string[];
  callToAction?: string;
  characterCount: number;
  platformValid: boolean;
  warnings: string[];
}

interface CreateEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
}

export function CreateEntryDialog({
  open,
  onOpenChange,
  defaultDate,
}: CreateEntryDialogProps) {
  // ── form state ──────────────────────────────────────────────────────────────
  const [topic, setTopic] = useState("");
  const [brandId, setBrandId] = useState("");
  const [scheduledFor, setScheduledFor] = useState(defaultDate ?? "");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [manualContent, setManualContent] = useState("");
  const [useManual, setUseManual] = useState(false);

  // ── AI generation state ─────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [variants, setVariants] = useState<ContentVariant[]>([]);
  const [variantIndex, setVariantIndex] = useState(0);
  const [selectedVariantContent, setSelectedVariantContent] = useState<string | null>(null);

  const { activeBrands } = useBrands();
  const { accounts } = useAccounts();
  const createMutation = useCreateCalendarEntry();

  const accountList =
    (accounts as Array<{
      _id: string;
      platform: string;
      displayName?: string;
      username: string;
    }>) ?? [];

  const selectedBrand = activeBrands.find((b) => b.id === brandId) ?? null;

  // Platform for generation: first selected account's platform, or "instagram"
  const generationPlatform =
    selectedAccountIds.length > 0
      ? (accountList.find((a) => a._id === selectedAccountIds[0])?.platform ?? "instagram")
      : "instagram";

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ── AI generation ───────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }
    if (!selectedBrand) {
      toast.error("Select a brand first");
      return;
    }

    setIsGenerating(true);
    setVariants([]);
    setSelectedVariantContent(null);

    try {
      const brandContext = buildBrandContext(selectedBrand);
      const res = await fetch("/api/ai/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          platform: generationPlatform,
          tone: selectedBrand.tone,
          brandContext,
          numVariants: 3,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Generation failed");
      }

      const data = (await res.json()) as { variants: ContentVariant[] };
      if (!data.variants?.length) throw new Error("No variants returned");

      setVariants(data.variants);
      setVariantIndex(0);
      setSelectedVariantContent(data.variants[0].content);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate content");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Topic is required");
      return;
    }
    if (!brandId) {
      toast.error("Select a brand");
      return;
    }

    const scheduledIso = scheduledFor
      ? new Date(`${scheduledFor}T${scheduledTime}:00`).toISOString()
      : undefined;

    const platforms = selectedAccountIds.map((accountId) => {
      const acc = accountList.find((a) => a._id === accountId);
      return { platform: acc?.platform ?? "", accountId };
    });

    // Determine final content:
    // 1. If manual mode — use manualContent
    // 2. If a variant was selected — use it (queues AI on server if none)
    // 3. Otherwise — let the server generate (no content = AI queued)
    const finalContent = useManual
      ? manualContent || undefined
      : selectedVariantContent ?? undefined;

    try {
      await createMutation.mutateAsync({
        topic: topic.trim(),
        brandId,
        scheduledFor: scheduledIso,
        platforms,
        content: finalContent,
      });

      toast.success(
        finalContent
          ? "Entry created"
          : "Entry created — AI generation queued"
      );
      onOpenChange(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create entry");
    }
  };

  const resetForm = () => {
    setTopic("");
    setBrandId("");
    setScheduledFor(defaultDate ?? "");
    setScheduledTime("09:00");
    setSelectedAccountIds([]);
    setManualContent("");
    setUseManual(false);
    setVariants([]);
    setVariantIndex(0);
    setSelectedVariantContent(null);
  };

  const currentVariant = variants[variantIndex] ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Plan Content
          </DialogTitle>
          <DialogDescription>
            Add a topic and let AI draft the post, or write it yourself.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Topic */}
          <div className="space-y-1.5">
            <Label htmlFor="topic">Topic *</Label>
            <Input
              id="topic"
              placeholder="e.g. 5 tips for better morning routines"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                // Clear variants when topic changes
                if (variants.length > 0) {
                  setVariants([]);
                  setSelectedVariantContent(null);
                }
              }}
              autoFocus
            />
          </div>

          {/* Brand */}
          <div className="space-y-1.5">
            <Label>Brand *</Label>
            <Select
              value={brandId}
              onValueChange={(v) => {
                setBrandId(v);
                setVariants([]);
                setSelectedVariantContent(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a brand" />
              </SelectTrigger>
              <SelectContent>
                {activeBrands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.brandName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeBrands.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No brands yet.{" "}
                <a href="/dashboard/brands" className="underline text-primary">
                  Create one first.
                </a>
              </p>
            )}
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {/* Accounts */}
          {accountList.length > 0 && (
            <div className="space-y-1.5">
              <Label>Publish to</Label>
              <div className="rounded-md border border-border divide-y divide-border max-h-36 overflow-y-auto">
                {accountList.map((acc) => (
                  <label
                    key={acc._id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedAccountIds.includes(acc._id)}
                      onCheckedChange={() => toggleAccount(acc._id)}
                    />
                    <span className="text-sm capitalize">
                      {getPlatformName(acc.platform)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      @{acc.username}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Manual content toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={useManual}
              onCheckedChange={(v) => {
                setUseManual(!!v);
                if (v) {
                  setVariants([]);
                  setSelectedVariantContent(null);
                }
              }}
            />
            <span className="text-sm">Write content myself (skip AI)</span>
          </label>

          {/* Manual textarea */}
          {useManual && (
            <div className="space-y-1.5">
              <Label htmlFor="manual-content">Content</Label>
              <Textarea
                id="manual-content"
                placeholder="Write your post content here…"
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {/* AI Generate button — shown when not manual and brand+topic set */}
          {!useManual && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim() || !brandId}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {variants.length > 0 ? "Regenerate" : "Generate with AI"}
                  </>
                )}
              </Button>

              {/* Variant picker */}
              {variants.length > 0 && currentVariant && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  {/* Nav header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">
                      Variant {variantIndex + 1} of {variants.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          const i = (variantIndex - 1 + variants.length) % variants.length;
                          setVariantIndex(i);
                          setSelectedVariantContent(variants[i].content);
                        }}
                        disabled={variants.length <= 1}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          const i = (variantIndex + 1) % variants.length;
                          setVariantIndex(i);
                          setSelectedVariantContent(variants[i].content);
                        }}
                        disabled={variants.length <= 1}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      {/* Use / selected indicator */}
                      <Button
                        type="button"
                        variant={
                          selectedVariantContent === currentVariant.content
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() =>
                          setSelectedVariantContent(
                            selectedVariantContent === currentVariant.content
                              ? null
                              : currentVariant.content
                          )
                        }
                      >
                        {selectedVariantContent === currentVariant.content ? (
                          <>
                            <Check className="mr-1 h-3 w-3" />
                            Selected
                          </>
                        ) : (
                          "Use this"
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Content preview — editable */}
                  <Textarea
                    value={
                      selectedVariantContent === currentVariant.content
                        ? selectedVariantContent
                        : currentVariant.content
                    }
                    onChange={(e) => {
                      // If editing the selected variant, update it
                      if (selectedVariantContent === currentVariant.content) {
                        setSelectedVariantContent(e.target.value);
                      }
                      setVariants((prev) =>
                        prev.map((v, i) =>
                          i === variantIndex ? { ...v, content: e.target.value } : v
                        )
                      );
                    }}
                    rows={5}
                    className="text-sm resize-none"
                  />

                  {/* Hashtags + char count */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {currentVariant.hashtags.slice(0, 5).map((h) => (
                      <Badge key={h} variant="secondary" className="text-xs px-1.5 py-0">
                        {h}
                      </Badge>
                    ))}
                    {currentVariant.hashtags.length > 5 && (
                      <span className="text-xs text-muted-foreground">
                        +{currentVariant.hashtags.length - 5} more
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {currentVariant.content.length} chars
                      {!currentVariant.platformValid && (
                        <span className="ml-1 text-destructive">
                          · over limit
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Warnings */}
                  {currentVariant.warnings.length > 0 && (
                    <ul className="space-y-0.5">
                      {currentVariant.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠ {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit as never}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {useManual
              ? "Save Entry"
              : selectedVariantContent
              ? "Save Entry"
              : "Queue AI Generation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildBrandContext(brand: SavedBrand) {
  return {
    brandName: brand.brandName,
    description: brand.description,
    tone: brand.tone,
    voice: brand.voice,
    targetAudience: brand.targetAudience,
    industry: brand.industry,
    hashtags: brand.hashtags ?? [],
    doList: brand.doList ?? [],
    dontList: brand.dontList ?? [],
    defaultCTA: brand.defaultCTA,
  };
}
