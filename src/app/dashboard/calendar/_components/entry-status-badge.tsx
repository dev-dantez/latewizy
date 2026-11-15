import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, XCircle, Send, Sparkles, AlertCircle } from "lucide-react";
import type { CalendarEntryStatus } from "@/hooks/use-calendar-entries";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  CalendarEntryStatus,
  { label: string; icon: React.ElementType; className: string; spin?: boolean }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-muted text-muted-foreground border-muted",
  },
  generating: {
    label: "Generating…",
    icon: Loader2,
    className: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    spin: true,
  },
  ready: {
    label: "Ready",
    icon: Sparkles,
    className: "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  publishing: {
    label: "Publishing…",
    icon: Loader2,
    className: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    spin: true,
  },
  published: {
    label: "Published",
    icon: Send,
    className: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-muted text-muted-foreground border-muted",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    className: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  },
};

export function EntryStatusBadge({ status }: { status: CalendarEntryStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", config.className)}>
      <Icon className={cn("h-3 w-3", config.spin && "animate-spin")} />
      {config.label}
    </Badge>
  );
}
