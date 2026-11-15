"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAutopilotConfig, useUpsertAutopilotConfig } from "@/hooks/use-autopilot";
import { useAccounts } from "@/hooks/use-accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Plus, X, Clock } from "lucide-react";
import { getPlatformName } from "@/lib/late-api/types";
import type { SavedBrand } from "@/types/brand";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AutopilotCardProps {
  brand: SavedBrand;
}

interface ContentTheme {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export function AutopilotCard({ brand }: AutopilotCardProps) {
  const { data: config, isLoading } = useAutopilotConfig(brand.id);
  const upsert = useUpsertAutopilotConfig(brand.id);
  const { accounts } = useAccounts();

  const accountList =
    (accounts as Array<{ _id: string; platform: string; username: string }>) ?? [];

  // ── local form state ────────────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);
  const [postsPerCycle, setPostsPerCycle] = useState(3);
  const [lookaheadDays, setLookaheadDays] = useState(7);
  const [schedule, setSchedule] = useState<Array<{ dayOfWeek: number; time: string }>>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [themes, setThemes] = useState<ContentTheme[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Sync from server
  useEffect(() => {
    if (!config) return;
    setEnabled(config.enabled);
    setRequireApproval(config.requireApproval);
    setPostsPerCycle(config.postsPerCycle);
    setLookaheadDays(config.lookaheadDays);
    setSchedule(
      (config.schedule as Array<{ dayOfWeek: number; time: string }>) ?? []
    );
    setSelectedAccountIds(
      (config.targetPlatforms as Array<{ accountId: string }> | null)?.map(
        (p) => p.accountId
      ) ?? []
    );
    setThemes(
      (config.themes as ContentTheme[] | null)?.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        weight: t.weight,
      })) ?? []
    );
    setIsDirty(false);
  }, [config]);

  const mark = () => setIsDirty(true);

  // ── schedule helpers ─────────────────────────────────────────────────────────
  const addSlot = () => {
    setSchedule((s) => [...s, { dayOfWeek: 1, time: "09:00" }]);
    mark();
  };

  const removeSlot = (i: number) => {
    setSchedule((s) => s.filter((_, idx) => idx !== i));
    mark();
  };

  const updateSlot = (
    i: number,
    field: "dayOfWeek" | "time",
    value: number | string
  ) => {
    setSchedule((s) =>
      s.map((slot, idx) =>
        idx === i ? { ...slot, [field]: value } : slot
      )
    );
    mark();
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    mark();
  };

  // ── theme helpers ───────────────────────────────────────────────────────────
  const addTheme = () => {
    setThemes((t) => [
      ...t,
      {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        // Keep the total near 1.0 as themes are added
        weight: t.length === 0 ? 1 : 1 / (t.length + 1),
      },
    ]);
    mark();
  };

  const removeTheme = (id: string) => {
    setThemes((t) => t.filter((th) => th.id !== id));
    mark();
  };

  const updateTheme = (
    id: string,
    field: keyof Omit<ContentTheme, "id">,
    value: string | number
  ) => {
    setThemes((t) =>
      t.map((th) => (th.id === id ? { ...th, [field]: value } : th))
    );
    mark();
  };

  const themeWeightTotal = themes.reduce(
    (sum, t) => sum + (Number(t.weight) || 0),
    0
  );
  const weightsValid =
    themes.length > 0 && Math.abs(themeWeightTotal - 1) < 0.001;
  const themesReady = themes.length > 0 && weightsValid;

  // ── save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const targetPlatforms = selectedAccountIds.map((accountId) => {
      const acc = accountList.find((a) => a._id === accountId);
      return { platform: acc?.platform ?? "", accountId };
    });

    try {
      await upsert.mutateAsync({
        enabled,
        requireApproval,
        postsPerCycle,
        lookaheadDays,
        schedule,
        targetPlatforms,
        themes: themes
          .filter((t) => t.name.trim() !== "")
          .map((t) => ({
            id: t.id,
            name: t.name.trim(),
            description: t.description,
            weight: Number(t.weight) || 0,
          })),
      });
      toast.success("Autopilot config saved");
      setIsDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Autopilot — {brand.brandName}
          </CardTitle>
          <CardDescription>
            Automatically generate and schedule posts for this brand.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {enabled && (
            <Badge className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">
              Active
            </Badge>
          )}
          <Switch
            checked={enabled}
            onCheckedChange={(v) => { setEnabled(v); mark(); }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Posting schedule */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Posting Schedule
          </Label>
          <div className="space-y-2">
            {schedule.map((slot, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={slot.dayOfWeek}
                  onChange={(e) => updateSlot(i, "dayOfWeek", Number(e.target.value))}
                >
                  {DAYS.map((d, idx) => (
                    <option key={d} value={idx}>{d}</option>
                  ))}
                </select>
                <Input
                  type="time"
                  value={slot.time}
                  onChange={(e) => updateSlot(i, "time", e.target.value)}
                  className="h-8 w-28"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSlot(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={addSlot}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add time slot
          </Button>
        </div>

        {/* Posts per cycle & lookahead */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`posts-${brand.id}`}>Posts per cycle</Label>
            <Input
              id={`posts-${brand.id}`}
              type="number"
              min={1}
              max={20}
              value={postsPerCycle}
              onChange={(e) => { setPostsPerCycle(Number(e.target.value)); mark(); }}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`look-${brand.id}`}>Lookahead days</Label>
            <Input
              id={`look-${brand.id}`}
              type="number"
              min={1}
              max={30}
              value={lookaheadDays}
              onChange={(e) => { setLookaheadDays(Number(e.target.value)); mark(); }}
              className="h-8"
            />
          </div>
        </div>

        {/* Content themes */}
        <div className="space-y-2">
          <Label>Content themes</Label>
          <p className="text-xs text-muted-foreground">
            Topics the autopilot picks from. Weights must sum to 1.0.
          </p>
          <div className="space-y-2">
            {themes.map((th) => (
              <div key={th.id} className="rounded-md border border-border p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Theme name"
                    value={th.name}
                    onChange={(e) => updateTheme(th.id, "name", e.target.value)}
                    className="h-8 flex-1"
                  />
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={1}
                    placeholder="Weight"
                    value={th.weight}
                    onChange={(e) => updateTheme(th.id, "weight", Number(e.target.value))}
                    className="h-8 w-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeTheme(th.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  placeholder="What this theme is about (used as the generation topic)"
                  value={th.description}
                  onChange={(e) => updateTheme(th.id, "description", e.target.value)}
                  className="min-h-[44px] text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={addTheme}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add theme
            </Button>
            <span
              className={
                "text-xs " +
                (themes.length === 0
                  ? "text-muted-foreground"
                  : weightsValid
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive")
              }
            >
              Weights total: {themeWeightTotal.toFixed(2)}
              {themes.length > 0 && (weightsValid ? " ✓" : " — must sum to 1.0")}
            </span>
          </div>
        </div>

        {/* Platforms */}
        {accountList.length > 0 && (
          <div className="space-y-2">
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
                  <span className="text-xs text-muted-foreground">
                    @{acc.username}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Require approval */}
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="space-y-0.5">
            <Label className="text-sm">Require approval before publishing</Label>
            <p className="text-xs text-muted-foreground">
              Generated posts wait in the Planner for your review.
            </p>
          </div>
          <Switch
            checked={requireApproval}
            onCheckedChange={(v) => { setRequireApproval(v); mark(); }}
          />
        </div>

        {/* Save */}
        {isDirty && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={upsert.isPending || (enabled && !themesReady)}
            className="w-full"
          >
            {upsert.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Autopilot Config
          </Button>
        )}
        {enabled && themes.length === 0 && isDirty && (
          <p className="text-xs text-destructive text-center">
            Add at least one theme before enabling Autopilot.
          </p>
        )}
        {enabled && themes.length > 0 && !weightsValid && isDirty && (
          <p className="text-xs text-destructive text-center">
            Theme weights must sum to 1.0 (currently {themeWeightTotal.toFixed(2)}).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
