"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { getPlatformName } from "@/lib/late-api";
import { formatMetric, formatRate } from "@/lib/analytics/date-range";
import type { AnalyticsPost } from "@/types/analytics";
import { Search, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface PostsTableProps {
  posts?: AnalyticsPost[];
  isLoading?: boolean;
  total?: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function PostsTable({
  posts,
  isLoading,
  total = 0,
  page,
  limit,
  onPageChange,
}: PostsTableProps) {
  const [search, setSearch] = useState("");

  const filtered = posts?.filter((p) =>
    !search || p.content?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Post Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium">Post Performance</CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search posts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!filtered?.length ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No posts found for this period.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium pr-4">Post</th>
                    <th className="pb-2 text-left font-medium pr-4">Platform</th>
                    <th className="pb-2 text-right font-medium pr-4">Impressions</th>
                    <th className="pb-2 text-right font-medium pr-4">Reach</th>
                    <th className="pb-2 text-right font-medium pr-4">Likes</th>
                    <th className="pb-2 text-right font-medium pr-4">Comments</th>
                    <th className="pb-2 text-right font-medium pr-4">Shares</th>
                    <th className="pb-2 text-right font-medium pr-4">Eng. Rate</th>
                    <th className="pb-2 text-left font-medium">Published</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((post) => {
                    const analytics = post.analytics;
                    const platform = post.platform;
                    const publishedAt = post.publishedAt;
                    return (
                      <tr
                        key={post._id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2.5 pr-4 max-w-[220px]">
                          <div className="flex items-center gap-2">
                            {post.thumbnailUrl && (
                              <img
                                src={post.thumbnailUrl}
                                alt=""
                                className="h-8 w-8 rounded object-cover shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-xs text-foreground leading-snug">
                                {post.content || "(no caption)"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            {platform && (
                              <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
                            )}
                            <span className="text-xs text-muted-foreground">
                              {platform ? getPlatformName(platform) : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-xs">
                          {formatMetric(analytics?.impressions)}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-xs">
                          {formatMetric(analytics?.reach)}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-xs">
                          {formatMetric(analytics?.likes)}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-xs">
                          {formatMetric(analytics?.comments)}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-xs">
                          {formatMetric(analytics?.shares)}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-xs">
                          {formatRate(analytics?.engagementRate)}
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {publishedAt
                              ? format(parseISO(publishedAt), "MMM d, yyyy")
                              : "—"}
                            {post.platformPostUrl && (
                              <a
                                href={post.platformPostUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Open post"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">
                  {total} posts total
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
