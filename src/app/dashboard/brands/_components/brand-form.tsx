"use client";

/**
 * BrandForm — Dialog-based create/edit form for SavedBrand.
 * Handles both CREATE (no initialValues) and EDIT (initialValues provided).
 */

import { useState, useCallback, useEffect, KeyboardEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X, Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { useBrandActions } from "@/hooks/use-brands";
import type { SavedBrand } from "@/types/brand";

// ─── Schema ──────────────────────────────────────────────────────────────────

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const brandFormSchema = z.object({
  brandName: z.string().min(1, "Required").max(100),
  description: z.string().min(1, "Required").max(500),
  website: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  industry: z.string().min(1, "Required").max(100),
  niche: z.string().max(100).optional(),
  tone: z.string().min(1, "Required").max(50),
  voice: z.string().max(200).optional(),
  personality: z.string().max(200).optional(),
  targetAudience: z.string().min(1, "Required").max(200),
  language: z.string().max(50).optional(),
  writingStyle: z.string().max(200).optional(),
  contentRestrictions: z.string().max(500).optional(),
  additionalInstructions: z.string().max(1000).optional(),
  hashtags: z.array(z.string()),
  doList: z.array(z.string()),
  dontList: z.array(z.string()),
  defaultCTA: z.string().min(1, "Required").max(200),
  primaryColor: z
    .string()
    .regex(HEX_RE, "Must be a valid hex color")
    .or(z.literal(""))
    .optional(),
  secondaryColor: z
    .string()
    .regex(HEX_RE, "Must be a valid hex color")
    .or(z.literal(""))
    .optional(),
  accentColor: z
    .string()
    .regex(HEX_RE, "Must be a valid hex color")
    .or(z.literal(""))
    .optional(),
  backgroundColor: z
    .string()
    .regex(HEX_RE, "Must be a valid hex color")
    .or(z.literal(""))
    .optional(),
  headingFont: z.string().max(100).optional(),
  bodyFont: z.string().max(100).optional(),
  logoUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  imageStyle: z.string().max(100).optional(),
  photographyStyle: z.string().max(100).optional(),
  illustrationStyle: z.string().max(100).optional(),
  preferredColors: z.array(z.string()),
  colorsToAvoid: z.array(z.string()),
  imageInstructions: z.string().max(500).optional(),
  isDefault: z.boolean(),
});

type BrandFormValues = z.infer<typeof brandFormSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TONE_SUGGESTIONS = [
  "Professional",
  "Casual",
  "Witty",
  "Inspirational",
  "Playful",
  "Authoritative",
  "Friendly",
  "Formal",
];

const IMAGE_STYLE_SUGGESTIONS = [
  "Modern & Minimal",
  "Vibrant & Bold",
  "Natural & Earthy",
  "Corporate & Clean",
  "Artistic & Creative",
  "Dark & Moody",
  "Light & Airy",
];

// ─── Tag Input ────────────────────────────────────────────────────────────────

interface TagInputProps {
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
  /** Prefix to prepend automatically (e.g. "#" for hashtags) */
  prefix?: string;
  errorMessage?: string;
}

function TagInput({ value, onChange, placeholder, prefix, errorMessage }: TagInputProps) {
  const [input, setInput] = useState("");

  const add = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const tag = prefix && !trimmed.startsWith(prefix) ? `${prefix}${trimmed}` : trimmed;
    if (!value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  }, [input, onChange, prefix, value]);

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="text-sm h-8"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 px-3" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}

// ─── Color Field ──────────────────────────────────────────────────────────────

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
}

function ColorField({ label, value, onChange, error }: ColorFieldProps) {
  const hex = value && HEX_RE.test(value) ? value : "#ffffff";

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="text-sm h-8 font-mono"
          maxLength={7}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── List Input (do/don't lists) ──────────────────────────────────────────────

interface ListInputProps {
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
}

function ListInput({ value, onChange, placeholder }: ListInputProps) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || value.length >= 10) return;
    onChange([...value, trimmed]);
    setInput("");
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="text-sm h-8"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-3"
          onClick={add}
          disabled={value.length >= 10}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((item, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded bg-muted px-2 py-1 text-xs"
            >
              <span className="flex-1 truncate">{item}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface BrandFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: SavedBrand;
}

export function BrandForm({ open, onOpenChange, initialValues }: BrandFormProps) {
  const { createBrand, updateBrand } = useBrandActions();
  const isEdit = !!initialValues;

  const defaultValues: BrandFormValues = initialValues
    ? {
        brandName: initialValues.brandName,
        description: initialValues.description,
        website: initialValues.website ?? "",
        industry: initialValues.industry,
        niche: initialValues.niche ?? "",
        tone: initialValues.tone,
        voice: initialValues.voice ?? "",
        personality: initialValues.personality ?? "",
        targetAudience: initialValues.targetAudience,
        language: initialValues.language ?? "",
        writingStyle: initialValues.writingStyle ?? "",
        contentRestrictions: initialValues.contentRestrictions ?? "",
        additionalInstructions: initialValues.additionalInstructions ?? "",
        hashtags: initialValues.hashtags,
        doList: initialValues.doList,
        dontList: initialValues.dontList,
        defaultCTA: initialValues.defaultCTA,
        primaryColor: initialValues.primaryColor ?? "",
        secondaryColor: initialValues.secondaryColor ?? "",
        accentColor: initialValues.accentColor ?? "",
        backgroundColor: initialValues.backgroundColor ?? "",
        headingFont: initialValues.headingFont ?? "",
        bodyFont: initialValues.bodyFont ?? "",
        logoUrl: initialValues.logoUrl ?? "",
        imageStyle: initialValues.imageStyle ?? "",
        photographyStyle: initialValues.photographyStyle ?? "",
        illustrationStyle: initialValues.illustrationStyle ?? "",
        preferredColors: initialValues.preferredColors ?? [],
        colorsToAvoid: initialValues.colorsToAvoid ?? [],
        imageInstructions: initialValues.imageInstructions ?? "",
        isDefault: initialValues.isDefault,
      }
    : {
        brandName: "",
        description: "",
        website: "",
        industry: "",
        niche: "",
        tone: "",
        voice: "",
        personality: "",
        targetAudience: "",
        language: "",
        writingStyle: "",
        contentRestrictions: "",
        additionalInstructions: "",
        hashtags: [],
        doList: [],
        dontList: [],
        defaultCTA: "Learn more",
        primaryColor: "",
        secondaryColor: "",
        accentColor: "",
        backgroundColor: "",
        headingFont: "",
        bodyFont: "",
        logoUrl: "",
        imageStyle: "",
        photographyStyle: "",
        illustrationStyle: "",
        preferredColors: [],
        colorsToAvoid: [],
        imageInstructions: "",
        isDefault: false,
      };

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = form;

  // Re-populate fields whenever the dialog opens or the brand being edited changes.
  // useForm only applies defaultValues on the FIRST mount; without this reset,
  // opening Edit on a different brand (or reopening after close) shows stale/empty fields.
  useEffect(() => {
    if (open) {
      reset(
        initialValues
          ? {
              brandName: initialValues.brandName,
              description: initialValues.description,
              website: initialValues.website ?? "",
              industry: initialValues.industry,
              niche: initialValues.niche ?? "",
              tone: initialValues.tone,
              voice: initialValues.voice ?? "",
              personality: initialValues.personality ?? "",
              targetAudience: initialValues.targetAudience,
              language: initialValues.language ?? "",
              writingStyle: initialValues.writingStyle ?? "",
              contentRestrictions: initialValues.contentRestrictions ?? "",
              additionalInstructions: initialValues.additionalInstructions ?? "",
              hashtags: initialValues.hashtags,
              doList: initialValues.doList,
              dontList: initialValues.dontList,
              defaultCTA: initialValues.defaultCTA,
              primaryColor: initialValues.primaryColor ?? "",
              secondaryColor: initialValues.secondaryColor ?? "",
              accentColor: initialValues.accentColor ?? "",
              backgroundColor: initialValues.backgroundColor ?? "",
              headingFont: initialValues.headingFont ?? "",
              bodyFont: initialValues.bodyFont ?? "",
              logoUrl: initialValues.logoUrl ?? "",
              imageStyle: initialValues.imageStyle ?? "",
              photographyStyle: initialValues.photographyStyle ?? "",
              illustrationStyle: initialValues.illustrationStyle ?? "",
              preferredColors: initialValues.preferredColors ?? [],
              colorsToAvoid: initialValues.colorsToAvoid ?? [],
              imageInstructions: initialValues.imageInstructions ?? "",
              isDefault: initialValues.isDefault,
            }
          : {
              brandName: "",
              description: "",
              website: "",
              industry: "",
              niche: "",
              tone: "",
              voice: "",
              personality: "",
              targetAudience: "",
              language: "",
              writingStyle: "",
              contentRestrictions: "",
              additionalInstructions: "",
              hashtags: [],
              doList: [],
              dontList: [],
              defaultCTA: "Learn more",
              primaryColor: "",
              secondaryColor: "",
              accentColor: "",
              backgroundColor: "",
              headingFont: "",
              bodyFont: "",
              logoUrl: "",
              imageStyle: "",
              photographyStyle: "",
              illustrationStyle: "",
              preferredColors: [],
              colorsToAvoid: [],
              imageInstructions: "",
              isDefault: false,
            }
      );
    }
  }, [open, initialValues, reset]);

  const onSubmit = async (data: BrandFormValues) => {
    try {
      const payload = {
        brandName: data.brandName,
        description: data.description,
        website: data.website || undefined,
        industry: data.industry,
        niche: data.niche || undefined,
        tone: data.tone,
        voice: data.voice || "",
        personality: data.personality || undefined,
        targetAudience: data.targetAudience,
        language: data.language || undefined,
        writingStyle: data.writingStyle || undefined,
        contentRestrictions: data.contentRestrictions || undefined,
        additionalInstructions: data.additionalInstructions || undefined,
        hashtags: data.hashtags,
        doList: data.doList,
        dontList: data.dontList,
        defaultCTA: data.defaultCTA,
        primaryColor: data.primaryColor || undefined,
        secondaryColor: data.secondaryColor || undefined,
        accentColor: data.accentColor || undefined,
        backgroundColor: data.backgroundColor || undefined,
        headingFont: data.headingFont || undefined,
        bodyFont: data.bodyFont || undefined,
        logoUrl: data.logoUrl || undefined,
        imageStyle: data.imageStyle || undefined,
        photographyStyle: data.photographyStyle || undefined,
        illustrationStyle: data.illustrationStyle || undefined,
        preferredColors: data.preferredColors,
        colorsToAvoid: data.colorsToAvoid,
        imageInstructions: data.imageInstructions || undefined,
        isDefault: data.isDefault,
        isArchived: initialValues?.isArchived ?? false,
      };

      if (isEdit && initialValues) {
        updateBrand(initialValues.id, payload);
        toast.success("Brand updated.");
      } else {
        createBrand(payload);
        toast.success("Brand created.");
      }

      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to save brand. Please try again.");
      console.error(err);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle>{isEdit ? "Edit Brand" : "Create Brand"}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <Tabs defaultValue="basic" className="flex flex-col flex-1 min-h-0 mt-4">
            <TabsList className="mx-6 shrink-0 w-auto justify-start h-9">
              <TabsTrigger value="basic" className="text-xs px-3">Basic Info</TabsTrigger>
              <TabsTrigger value="voice" className="text-xs px-3">Voice &amp; Audience</TabsTrigger>
              <TabsTrigger value="content" className="text-xs px-3">Content</TabsTrigger>
              <TabsTrigger value="visual" className="text-xs px-3">Visual</TabsTrigger>
              <TabsTrigger value="images" className="text-xs px-3">Images</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* ── Basic Info ── */}
              <TabsContent value="basic" className="mt-0 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="brandName" className="text-xs">
                    Brand Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="brandName"
                    {...register("brandName")}
                    placeholder="Acme Corp"
                    className="text-sm"
                  />
                  {errors.brandName && (
                    <p className="text-xs text-destructive">{errors.brandName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="A short description of the brand…"
                    rows={3}
                    className="resize-none text-sm"
                  />
                  {errors.description && (
                    <p className="text-xs text-destructive">{errors.description.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="industry" className="text-xs">
                      Industry <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="industry"
                      {...register("industry")}
                      placeholder="SaaS, Fashion, Fitness…"
                      className="text-sm"
                    />
                    {errors.industry && (
                      <p className="text-xs text-destructive">{errors.industry.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="niche" className="text-xs">Niche</Label>
                    <Input
                      id="niche"
                      {...register("niche")}
                      placeholder="e.g. SME accounting"
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="website" className="text-xs">Website</Label>
                  <Input
                    id="website"
                    {...register("website")}
                    placeholder="https://example.com"
                    type="url"
                    className="text-sm"
                  />
                  {errors.website && (
                    <p className="text-xs text-destructive">{errors.website.message}</p>
                  )}
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Controller
                    name="isDefault"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        id="isDefault"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label htmlFor="isDefault" className="text-xs cursor-pointer">
                    Set as default brand
                  </Label>
                </div>
              </TabsContent>

              {/* ── Voice & Audience ── */}
              <TabsContent value="voice" className="mt-0 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Tone <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    name="tone"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={TONE_SUGGESTIONS.includes(field.value) ? field.value : "__custom__"}
                        onValueChange={(val) => {
                          if (val !== "__custom__") field.onChange(val);
                        }}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select or type below" />
                        </SelectTrigger>
                        <SelectContent>
                          {TONE_SUGGESTIONS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">Custom…</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Input
                    {...register("tone")}
                    placeholder="Or type a custom tone…"
                    className="text-sm"
                  />
                  {errors.tone && (
                    <p className="text-xs text-destructive">{errors.tone.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="voice" className="text-xs">Voice</Label>
                  <Input
                    id="voice"
                    {...register("voice")}
                    placeholder="Expert but approachable"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="personality" className="text-xs">Personality</Label>
                  <Input
                    id="personality"
                    {...register("personality")}
                    placeholder="Warm, curious, forward-thinking"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="targetAudience" className="text-xs">
                    Target Audience <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="targetAudience"
                    {...register("targetAudience")}
                    placeholder="Small business owners, age 25-45"
                    className="text-sm"
                  />
                  {errors.targetAudience && (
                    <p className="text-xs text-destructive">{errors.targetAudience.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="language" className="text-xs">Language</Label>
                  <Input
                    id="language"
                    {...register("language")}
                    placeholder="English, Swahili, French…"
                    className="text-sm"
                  />
                </div>
              </TabsContent>

              {/* ── Content Guidelines ── */}
              <TabsContent value="content" className="mt-0 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Hashtags</Label>
                  <Controller
                    name="hashtags"
                    control={control}
                    render={({ field }) => (
                      <TagInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="#yourbrand"
                        prefix="#"
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Do List</Label>
                  <Controller
                    name="doList"
                    control={control}
                    render={({ field }) => (
                      <ListInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Always end with a question"
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Don&apos;t List</Label>
                  <Controller
                    name="dontList"
                    control={control}
                    render={({ field }) => (
                      <ListInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Never use jargon"
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="defaultCTA" className="text-xs">
                    Default CTA <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="defaultCTA"
                    {...register("defaultCTA")}
                    placeholder="Learn more at our website"
                    className="text-sm"
                  />
                  {errors.defaultCTA && (
                    <p className="text-xs text-destructive">{errors.defaultCTA.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="writingStyle" className="text-xs">Writing Style</Label>
                  <Input
                    id="writingStyle"
                    {...register("writingStyle")}
                    placeholder="Short sentences, active voice"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contentRestrictions" className="text-xs">
                    Content Restrictions
                  </Label>
                  <Textarea
                    id="contentRestrictions"
                    {...register("contentRestrictions")}
                    placeholder="Avoid political topics, no price mentions…"
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="additionalInstructions" className="text-xs">
                    Additional Instructions
                  </Label>
                  <Textarea
                    id="additionalInstructions"
                    {...register("additionalInstructions")}
                    placeholder="Any extra guidance for the AI…"
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
              </TabsContent>

              {/* ── Visual Identity ── */}
              <TabsContent value="visual" className="mt-0 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="logoUrl" className="text-xs">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    {...register("logoUrl")}
                    placeholder="https://example.com/logo.png"
                    type="url"
                    className="text-sm"
                  />
                  {errors.logoUrl && (
                    <p className="text-xs text-destructive">{errors.logoUrl.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="primaryColor"
                    control={control}
                    render={({ field }) => (
                      <ColorField
                        label="Primary Color"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        error={errors.primaryColor?.message}
                      />
                    )}
                  />
                  <Controller
                    name="secondaryColor"
                    control={control}
                    render={({ field }) => (
                      <ColorField
                        label="Secondary Color"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        error={errors.secondaryColor?.message}
                      />
                    )}
                  />
                  <Controller
                    name="accentColor"
                    control={control}
                    render={({ field }) => (
                      <ColorField
                        label="Accent Color"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        error={errors.accentColor?.message}
                      />
                    )}
                  />
                  <Controller
                    name="backgroundColor"
                    control={control}
                    render={({ field }) => (
                      <ColorField
                        label="Background Color"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        error={errors.backgroundColor?.message}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="headingFont" className="text-xs">Heading Font</Label>
                    <Input
                      id="headingFont"
                      {...register("headingFont")}
                      placeholder="Inter, Playfair Display…"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bodyFont" className="text-xs">Body Font</Label>
                    <Input
                      id="bodyFont"
                      {...register("bodyFont")}
                      placeholder="Inter, Georgia…"
                      className="text-sm"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ── Image Guidelines ── */}
              <TabsContent value="images" className="mt-0 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Image Style</Label>
                  <Controller
                    name="imageStyle"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={
                          IMAGE_STYLE_SUGGESTIONS.includes(field.value ?? "")
                            ? (field.value ?? "")
                            : "__custom__"
                        }
                        onValueChange={(val) => {
                          if (val !== "__custom__") field.onChange(val);
                        }}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select a style" />
                        </SelectTrigger>
                        <SelectContent>
                          {IMAGE_STYLE_SUGGESTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">Custom…</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Input
                    {...register("imageStyle")}
                    placeholder="Or type a custom style…"
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="photographyStyle" className="text-xs">
                      Photography Style
                    </Label>
                    <Input
                      id="photographyStyle"
                      {...register("photographyStyle")}
                      placeholder="Natural light, candid…"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="illustrationStyle" className="text-xs">
                      Illustration Style
                    </Label>
                    <Input
                      id="illustrationStyle"
                      {...register("illustrationStyle")}
                      placeholder="Flat design, isometric…"
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Preferred Colors (for images)</Label>
                  <Controller
                    name="preferredColors"
                    control={control}
                    render={({ field }) => (
                      <TagInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="blue, gold, earthy tones…"
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Colors to Avoid</Label>
                  <Controller
                    name="colorsToAvoid"
                    control={control}
                    render={({ field }) => (
                      <TagInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="neon green, red…"
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="imageInstructions" className="text-xs">
                    Image Instructions
                  </Label>
                  <Textarea
                    id="imageInstructions"
                    {...register("imageInstructions")}
                    placeholder="Always show real people, no stock-photo clichés…"
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
              </TabsContent>
            </div>

            {/* Footer */}
            <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Brand"}
              </Button>
            </DialogFooter>
          </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}
