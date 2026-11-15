"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnalyticsFilters, DateRange } from "@/types/analytics";
import { rangeLabelMap } from "@/lib/analytics/date-range";
import { PLATFORMS, PLATFORM_NAMES } from "@/lib/late-api";
import type { Profile } from "@/hooks/use-profiles";

const DATE_RANGES = Object.entries(rangeLabelMap()) as [DateRange, string][];

interface AnalyticsFiltersProps {
  filters: AnalyticsFilters;
  profiles?: Array<{ _id: string; name?: string }>;
  onChange: (filters: AnalyticsFilters) => void;
}

export function AnalyticsFiltersBar({
  filters,
  profiles = [],
  onChange,
}: AnalyticsFiltersProps) {
  function update(partial: Partial<AnalyticsFilters>) {
    onChange({ ...filters, page: 1, ...partial });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Profile selector */}
      {profiles.length > 1 && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Profile</Label>
          <Select
            value={filters.profileId ?? "all"}
            onValueChange={(v) => update({ profileId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="All profiles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All profiles</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name ?? p._id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Platform selector */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Platform</Label>
        <Select
          value={filters.platform ?? "all"}
          onValueChange={(v) => update({ platform: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>
                {PLATFORM_NAMES[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Period</Label>
        <Select
          value={filters.dateRange}
          onValueChange={(v) => update({ dateRange: v as DateRange })}
        >
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Custom date range */}
      {filters.dateRange === "custom" && (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={filters.fromDate ?? ""}
              onChange={(e) => update({ fromDate: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={filters.toDate ?? ""}
              onChange={(e) => update({ toDate: e.target.value })}
            />
          </div>
        </>
      )}

      {/* Sort by */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Sort by</Label>
        <Select
          value={filters.sortBy ?? "date"}
          onValueChange={(v) => update({ sortBy: v as "date" | "engagement" })}
        >
          <SelectTrigger className="h-8 w-32 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="engagement">Engagement</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
