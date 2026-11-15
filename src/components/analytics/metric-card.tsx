"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMetric } from "@/lib/analytics/date-range";

interface MetricCardProps {
  title: string;
  value?: number | null;
  change?: number | null; // percentage
  description?: string;
  isLoading?: boolean;
  /** If true, shows "Unavailable" instead of "—" */
  unavailable?: boolean;
  suffix?: string;
  formatter?: (v: number) => string;
}

export function MetricCard({
  title,
  value,
  change,
  description,
  isLoading,
  unavailable,
  suffix,
  formatter,
}: MetricCardProps) {
  const display =
    unavailable
      ? "Unavailable"
      : formatter
      ? (value !== undefined && value !== null ? formatter(value) : "—")
      : formatMetric(value);

  const changeDisplay =
    change !== null && change !== undefined
      ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`
      : null;

  const changePositive = change !== null && change !== undefined && change > 0;
  const changeNegative = change !== null && change !== undefined && change < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {description}
            </TooltipContent>
          </Tooltip>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-end gap-2">
            <span
              className={cn(
                "text-2xl font-bold",
                unavailable && "text-muted-foreground text-base"
              )}
            >
              {display}
              {suffix && !unavailable && value !== undefined && value !== null && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {suffix}
                </span>
              )}
            </span>
            {changeDisplay && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium mb-0.5",
                  changePositive && "text-green-600 dark:text-green-400",
                  changeNegative && "text-red-500 dark:text-red-400",
                  !changePositive && !changeNegative && "text-muted-foreground"
                )}
              >
                {changePositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : changeNegative ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {changeDisplay}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
