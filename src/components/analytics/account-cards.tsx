"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { getPlatformName } from "@/lib/late-api";
import { formatMetric } from "@/lib/analytics/date-range";
import type { AccountWithFollowerStats } from "@/types/analytics";
import { Users, TrendingUp, TrendingDown } from "lucide-react";

interface AccountCardsProps {
  accounts?: AccountWithFollowerStats[];
  isLoading?: boolean;
  hasAnalyticsAccess?: boolean;
}

export function AccountCards({ accounts, isLoading, hasAnalyticsAccess }: AccountCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (!accounts?.length) {
    return (
      <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
        No connected accounts found for this period.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {accounts.map((account) => (
        <AccountCard
          key={account._id}
          account={account}
          hasAnalyticsAccess={hasAnalyticsAccess}
        />
      ))}
    </div>
  );
}

function AccountCard({
  account,
  hasAnalyticsAccess,
}: {
  account: AccountWithFollowerStats;
  hasAnalyticsAccess?: boolean;
}) {
  const hasFollowerData =
    hasAnalyticsAccess &&
    account.currentFollowers !== undefined &&
    account.currentFollowers !== null;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <PlatformIcon
            platform={account.platform ?? ""}
            className="h-4 w-4 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {account.displayName ?? account.username ?? "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @{account.username} · {getPlatformName(account.platform ?? "")}
            </p>
          </div>
        </div>

        {hasFollowerData ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                Followers
              </div>
              <span className="text-sm font-semibold">
                {formatMetric(account.currentFollowers)}
              </span>
            </div>
            {account.growth !== undefined && account.growth !== null && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {account.growth >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  Growth
                </div>
                <span
                  className={`text-xs font-medium ${
                    account.growth >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {account.growth >= 0 ? "+" : ""}
                  {formatMetric(account.growth)}
                  {account.growthPercentage !== undefined && (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({account.growthPercentage >= 0 ? "+" : ""}
                      {account.growthPercentage.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {hasAnalyticsAccess === false ? (
              <Badge variant="outline" className="text-[10px]">
                Analytics add-on required
              </Badge>
            ) : (
              "Follower data unavailable"
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
