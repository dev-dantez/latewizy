"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  useCalendarEntry,
  useUpdateCalendarEntry,
  useDeleteCalendarEntry,
  useApproveCalendarEntry,
} from "@/hooks/use-calendar-entries";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EntryStatusBadge } from "./entry-status-badge";
import { Loader2, CheckCircle2, Trash2, XCircle, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getPlatformName } from "@/lib/late-api/types";
import { format } from "date-fns/format";

interface EntryDetailSheetProps {
  entryId: string | null;
  onClose: () => void;
}

export function EntryDetailSheet({ entryId, onClose }: EntryDetailSheetProps) {
  const { data: entry, isLoading } = useCalendarEntry(entryId ?? "");
  const updateMutation = useUpdateCalendarEntry();
  const deleteMutation = useDeleteCalendarEntry();
  const approveMutation = useApproveCalendarEntry();

  const [editContent, setEditContent] = useState("");
  const [editScheduledFor, setEditScheduledFor] = useState("");
  const [editTime, setEditTime] = useState("09:00");
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync form when entry loads
  useEffect(() => {
    if (!entry) return;
    setEditContent(entry.content ?? "");
    if (entry.scheduledFor) {
      const d = new Date(entry.scheduledFor);
      setEditScheduledFor(format(d, "yyyy-MM-dd"));
      setEditTime(format(d, "HH:mm"));
    }
    setIsDirty(false);
  }, [entry?.id, entry?.content, entry?.scheduledFor]);

  if (!entryId) return null;

  const canEdit = entry && ["ready", "rejected"].includes(entry.status);
  const canApprove = entry?.status === "ready";
  const canReject = entry?.status === "ready" || entry?.status === "approved";
  const canDelete = entry && !["publishing", "published"].includes(entry.status);
  const isInProgress = entry && ["pending", "generating", "publishing"].includes(entry.status);

  const handleSave = async () => {
    if (!entry) return;
    const scheduledIso =
      editScheduledFor
        ? new Date(`${editScheduledFor}T${editTime}:00`).toISOString()
        : null;
    try {
      await updateMutation.mutateAsync({
        id: entry.id,
        content: editContent,
        scheduledFor: scheduledIso,
      });
      toast.success("Entry updated");
      setIsDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleApprove = async () => {
    if (!entry) return;
    // Save edits first if dirty
    if (isDirty) await handleSave();
    try {
      await approveMutation.mutateAsync(entry.id);
      toast.success("Approved — publishing queued");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!entry) return;
    try {
      await updateMutation.mutateAsync({ id: entry.id, status: "rejected" });
      toast.success("Entry rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    try {
      await deleteMutation.mutateAsync(entry.id);
      toast.success("Entry deleted");
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <>
      <Sheet open={!!entryId} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 flex-wrap">
              <span className="truncate">{entry?.topic ?? "Loading…"}</span>
              {entry && <EntryStatusBadge status={entry.status} />}
            </SheetTitle>
            {entry && (
              <SheetDescription>
                {entry.scheduledFor
                  ? `Scheduled for ${format(new Date(entry.scheduledFor), "MMM d, yyyy 'at' h:mm a")}`
                  : "Not yet scheduled"}
              </SheetDescription>
            )}
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entry ? (
            <div className="mt-6 space-y-5">
              {/* In-progress notice */}
              {isInProgress && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  {entry.status === "generating"
                    ? "AI is writing the content — this page refreshes automatically."
                    : entry.status === "publishing"
                    ? "Publishing to social accounts…"
                    : "Queued for processing…"}
                </div>
              )}

              {/* Failure notice */}
              {entry.status === "failed" && entry.failureReason && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  <p className="font-medium">Publishing failed</p>
                  <p className="mt-1 text-xs opacity-80">{entry.failureReason}</p>
                </div>
              )}

              {/* Content */}
              <div className="space-y-1.5">
                <Label>Content</Label>
                {canEdit ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => {
                      setEditContent(e.target.value);
                      setIsDirty(true);
                    }}
                    rows={6}
                    placeholder="AI-generated content will appear here…"
                  />
                ) : (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap min-h-20">
                    {entry.content || (
                      <span className="text-muted-foreground italic">
                        No content yet
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Schedule */}
              {canEdit && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={editScheduledFor}
                      onChange={(e) => {
                        setEditScheduledFor(e.target.value);
                        setIsDirty(true);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={editTime}
                      onChange={(e) => {
                        setEditTime(e.target.value);
                        setIsDirty(true);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Platforms */}
              {(entry.platforms as Array<{ platform: string; accountId: string }>).length > 0 && (
                <div className="space-y-1.5">
                  <Label>Platforms</Label>
                  <div className="flex flex-wrap gap-2">
                    {(entry.platforms as Array<{ platform: string }>).map((p, i) => (
                      <span
                        key={i}
                        className="text-xs rounded-full bg-muted px-2.5 py-1 capitalize"
                      >
                        {getPlatformName(p.platform)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Published info */}
              {entry.status === "published" && entry.publishedAt && (
                <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
                  Published {format(new Date(entry.publishedAt), "MMM d, yyyy 'at' h:mm a")}
                  {entry.zernioPostId && (
                    <span className="block text-xs opacity-70 mt-0.5 font-mono">
                      Post ID: {entry.zernioPostId}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {isDirty && canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    Save
                  </Button>
                )}

                {canApprove && (
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={approveMutation.isPending || updateMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Approve & Publish
                  </Button>
                )}

                {canReject && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReject}
                    disabled={updateMutation.isPending}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Reject
                  </Button>
                )}

                {entry.status === "failed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Retry
                  </Button>
                )}

                {canDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive ml-auto"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Entry not found.
            </p>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The entry will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
