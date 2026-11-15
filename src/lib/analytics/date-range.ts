/**
 * Date range utilities for analytics filters.
 */

import type { AnalyticsFilters, DateRange } from "@/types/analytics";

export function dateRangeToParams(filters: AnalyticsFilters): {
  fromDate: string;
  toDate: string;
} {
  if (filters.dateRange === "custom") {
    return {
      fromDate: filters.fromDate ?? toISO(nDaysAgo(30)),
      toDate: filters.toDate ?? toISO(new Date()),
    };
  }
  return {
    fromDate: toISO(nDaysAgo(rangeToDays(filters.dateRange))),
    toDate: toISO(new Date()),
  };
}

export function rangeToDays(range: DateRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "6m":
      return 183;
    case "12m":
      return 365;
    default:
      return 30;
  }
}

export function rangeLabelMap(): Record<DateRange, string> {
  return {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    "6m": "Last 6 months",
    "12m": "Last 12 months",
    custom: "Custom range",
  };
}

function nDaysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Calculate percentage change, returning null when the baseline is 0 or missing.
 */
export function pctChange(
  current: number | undefined,
  previous: number | undefined
): number | null {
  if (
    current === undefined ||
    previous === undefined ||
    previous === 0
  ) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Format a metric value with compact notation for large numbers.
 */
export function formatMetric(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/**
 * Format an engagement rate (already a percentage float).
 */
export function formatRate(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  return `${value.toFixed(2)}%`;
}
