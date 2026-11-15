/**
 * TanStack Query hooks for LateWiz calendar entries (DB-backed).
 *
 * These are distinct from use-posts.ts which talks to Zernio directly.
 * CalendarEntries are planned/drafted posts managed by LateWiz before
 * they are submitted to Zernio for publishing.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEntryPlatform {
  platform: string;
  accountId: string;
  customContent?: string;
}

export type CalendarEntryStatus =
  | "pending"
  | "generating"
  | "ready"
  | "approved"
  | "publishing"
  | "published"
  | "rejected"
  | "failed";

export interface CalendarEntry {
  id: string;
  workspaceId: string;
  brandId: string;
  topic: string;
  content: string | null;
  hashtags: string[];
  mediaUrls: string[];
  platforms: CalendarEntryPlatform[];
  scheduledFor: string | null;
  status: CalendarEntryStatus;
  zernioPostId: string | null;
  generatedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  rejectedAt: string | null;
  failureReason: string | null;
  source: "manual" | "autopilot";
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarEntryInput {
  brandId: string;
  topic: string;
  scheduledFor?: string;
  platforms?: CalendarEntryPlatform[];
  source?: "manual" | "autopilot";
  content?: string; // skip AI generation if provided
}

export interface UpdateCalendarEntryInput {
  content?: string;
  topic?: string;
  scheduledFor?: string | null;
  platforms?: CalendarEntryPlatform[];
  status?: "pending" | "generating" | "ready" | "approved" | "rejected";
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const calendarEntryKeys = {
  all: ["calendar-entries"] as const,
  lists: () => ["calendar-entries", "list"] as const,
  list: (filters: { dateFrom?: string; dateTo?: string; status?: string }) =>
    ["calendar-entries", "list", filters] as const,
  detail: (id: string) => ["calendar-entries", "detail", id] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCalendarEntries(filters: {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
} = {}) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.status) params.set("status", filters.status);

  return useQuery({
    queryKey: calendarEntryKeys.list(filters),
    queryFn: () =>
      apiFetch<{ entries: CalendarEntry[] }>(
        `/api/calendar/entries?${params}`
      ).then((r) => r.entries),
    // Refetch every 10 seconds to pick up background job completions
    refetchInterval: 10_000,
  });
}

export function useCalendarEntry(id: string) {
  return useQuery({
    queryKey: calendarEntryKeys.detail(id),
    queryFn: () =>
      apiFetch<{ entry: CalendarEntry }>(`/api/calendar/entries/${id}`).then(
        (r) => r.entry
      ),
    enabled: !!id,
    refetchInterval: (query) => {
      // Poll faster while in-progress
      const status = query.state.data?.status;
      return status === "pending" || status === "generating" ? 3_000 : false;
    },
  });
}

export function useCreateCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCalendarEntryInput) =>
      apiFetch<{ entry: CalendarEntry }>("/api/calendar/entries", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.entry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarEntryKeys.lists() });
    },
  });
}

export function useUpdateCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateCalendarEntryInput & { id: string }) =>
      apiFetch<{ entry: CalendarEntry }>(`/api/calendar/entries/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }).then((r) => r.entry),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: calendarEntryKeys.detail(data.id) });
      qc.invalidateQueries({ queryKey: calendarEntryKeys.lists() });
    },
  });
}

export function useDeleteCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/calendar/entries/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarEntryKeys.lists() });
    },
  });
}

export function useApproveCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/calendar/entries/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarEntryKeys.lists() });
    },
  });
}
