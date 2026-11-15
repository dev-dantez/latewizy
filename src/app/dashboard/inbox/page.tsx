"use client";

import { useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useAppStore } from "@/stores";
import { useProfiles } from "@/hooks";
import { useAccounts } from "@/hooks/use-accounts";
import {
  useInboxComments,
  usePostComments,
  useReplyToPost,
  useHideComment,
  useUnhideComment,
  useLikeComment,
  useDeleteComment,
  useInboxConversations,
  useConversationMessages,
  useSendMessage,
  useArchiveConversation,
  type CommentItem,
  type ConversationItem,
} from "@/hooks/use-inbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { getPlatformName, PLATFORMS } from "@/lib/late-api";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Send,
  EyeOff,
  Eye,
  Heart,
  Trash2,
  Reply,
  Archive,
  RotateCcw,
  ChevronRight,
  Search,
  ExternalLink,
} from "lucide-react";

// ============================================================================
// Comments tab
// ============================================================================

function CommentsTab() {
  const { defaultProfileId } = useAppStore();
  const { data: profilesData } = useProfiles();
  const profiles = profilesData?.profiles ?? [];

  const [profileId, setProfileId] = useState<string | undefined>(defaultProfileId ?? undefined);
  const [platform, setPlatform] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "comments">("date");
  const [selectedPost, setSelectedPost] = useState<CommentItem | null>(null);
  const [replyText, setReplyText] = useState("");

  const commentsQuery = useInboxComments({
    profileId,
    platform: platform === "all" ? undefined : platform,
    sortBy,
    sortOrder: "desc",
    limit: 25,
  });

  const postCommentsQuery = usePostComments(selectedPost?.id ?? "");
  const replyMutation = useReplyToPost();
  const hideMutation = useHideComment();
  const unhideMutation = useUnhideComment();
  const likeMutation = useLikeComment();
  const deleteMutation = useDeleteComment();

  const posts = commentsQuery.data?.data ?? [];

  async function handleReply(commentId?: string) {
    if (!selectedPost?.id || !selectedPost.accountId || !replyText.trim()) return;
    await replyMutation.mutateAsync({
      postId: selectedPost.id,
      accountId: selectedPost.accountId,
      message: replyText.trim(),
      commentId,
    });
    setReplyText("");
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
      {/* Left: post list */}
      <div className="w-80 shrink-0 flex flex-col gap-2">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {profiles.length > 1 && (
            <Select value={profileId ?? "all"} onValueChange={(v) => setProfileId(v === "all" ? undefined : v)}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue placeholder="Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All profiles</SelectItem>
                {profiles.map((p: any) => (
                  <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>{getPlatformName(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">By date</SelectItem>
              <SelectItem value="comments">By comments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Post list */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {commentsQuery.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          ) : !posts.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No posts with comments found.
            </div>
          ) : (
            posts.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className={cn(
                  "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                  selectedPost?.id === post.id && "bg-muted"
                )}
              >
                <div className="flex items-start gap-2">
                  <PlatformIcon platform={post.platform as any} className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{post.accountUsername}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{post.content || "(no caption)"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {post.commentCount !== undefined && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" />
                          {post.commentCount}
                        </span>
                      )}
                      {post.createdTime && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(parseISO(post.createdTime), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: comment thread */}
      <div className="flex-1 flex flex-col rounded-lg border border-border overflow-hidden">
        {!selectedPost ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a post to view its comments.
          </div>
        ) : (
          <>
            {/* Post header */}
            <div className="border-b border-border p-3 flex items-center gap-2 shrink-0">
              <PlatformIcon platform={selectedPost.platform as any} className="h-4 w-4" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedPost.accountUsername}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{selectedPost.content}</p>
              </div>
              {selectedPost.permalink && (
                <a href={selectedPost.permalink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {postCommentsQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                    <Skeleton className="h-12 flex-1 rounded-md" />
                  </div>
                ))
              ) : !postCommentsQuery.data?.comments?.length ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No comments yet.
                </div>
              ) : (
                postCommentsQuery.data.comments.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    postId={selectedPost.id!}
                    accountId={selectedPost.accountId!}
                    platform={selectedPost.platform}
                    onHide={(cid) => hideMutation.mutate({ postId: selectedPost.id!, commentId: cid, accountId: selectedPost.accountId! })}
                    onUnhide={(cid) => unhideMutation.mutate({ postId: selectedPost.id!, commentId: cid })}
                    onLike={(cid) => likeMutation.mutate({ postId: selectedPost.id!, commentId: cid, accountId: selectedPost.accountId! })}
                    onDelete={(cid) => deleteMutation.mutate({ postId: selectedPost.id!, commentId: cid, accountId: selectedPost.accountId! })}
                    onReply={(cid) => handleReply(cid)}
                    replyText={replyText}
                    setReplyText={setReplyText}
                  />
                ))
              )}
            </div>

            {/* Reply box */}
            <div className="border-t border-border p-3 flex gap-2 shrink-0">
              <Textarea
                placeholder="Reply to post…"
                className="min-h-[60px] resize-none text-sm flex-1"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); }
                }}
              />
              <Button
                size="icon"
                className="shrink-0 h-auto self-end"
                disabled={!replyText.trim() || replyMutation.isPending}
                onClick={() => handleReply()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CommentRow({
  comment, postId, accountId, platform,
  onHide, onUnhide, onLike, onDelete, onReply,
  replyText, setReplyText,
}: {
  comment: any;
  postId: string;
  accountId: string;
  platform?: string;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (id: string) => void;
  replyText: string;
  setReplyText: (v: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);

  return (
    <div className="rounded-md border border-border p-2.5 space-y-1.5">
      <div className="flex items-start gap-2">
        {comment.from?.picture ? (
          <img src={comment.from.picture} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-medium">
            {(comment.from?.name ?? "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{comment.from?.name ?? comment.from?.username ?? "Unknown"}</span>
            {comment.from?.isOwner && <Badge variant="outline" className="text-[9px] px-1 py-0">You</Badge>}
            {comment.hidden && <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">Hidden</Badge>}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {comment.createdTime ? formatDistanceToNow(parseISO(comment.createdTime), { addSuffix: true }) : ""}
            </span>
          </div>
          <p className="text-sm mt-0.5 leading-snug">{comment.message}</p>
        </div>
      </div>
      {/* Actions */}
      <div className="flex gap-1 pl-8">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => { setShowReply(!showReply); }}>
          <Reply className="h-3 w-3" /> Reply
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => onLike(comment.id)}>
          <Heart className="h-3 w-3" /> Like
        </Button>
        {comment.hidden ? (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => onUnhide(comment.id)}>
            <Eye className="h-3 w-3" /> Unhide
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => onHide(comment.id)}>
            <EyeOff className="h-3 w-3" /> Hide
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive" onClick={() => onDelete(comment.id)}>
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
      </div>
      {showReply && (
        <div className="pl-8 flex gap-2">
          <Input
            placeholder={`Reply to ${comment.from?.name ?? "comment"}…`}
            className="h-7 text-xs flex-1"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { onReply(comment.id); setShowReply(false); } }}
          />
          <Button size="sm" className="h-7 px-2" onClick={() => { onReply(comment.id); setShowReply(false); }}>
            <Send className="h-3 w-3" />
          </Button>
        </div>
      )}
      {/* Nested replies */}
      {comment.replies?.map((reply: any) => (
        <div key={reply.id} className="pl-8 pt-1 border-t border-border/40">
          <div className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 text-[9px] font-medium">
              {(reply.from?.name ?? "?")[0]?.toUpperCase()}
            </div>
            <div>
              <span className="text-xs font-medium">{reply.from?.name ?? reply.from?.username}</span>
              <p className="text-xs text-muted-foreground leading-snug">{reply.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Conversations (DM) tab
// ============================================================================

function ConversationsTab() {
  const { defaultProfileId } = useAppStore();
  const { data: profilesData } = useProfiles();
  const profiles = profilesData?.profiles ?? [];

  const [profileId, setProfileId] = useState<string | undefined>(defaultProfileId ?? undefined);
  const [platform, setPlatform] = useState<string>("all");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const isWindowClosed = sendError?.includes("24-hour") ?? false;

  const convsQuery = useInboxConversations({
    profileId,
    platform: platform === "all" ? undefined : platform,
    status,
    limit: 30,
  });

  const msgsQuery = useConversationMessages(selectedConv?.id ?? "", selectedConv?.accountId);
  const sendMutation = useSendMessage();
  const archiveMutation = useArchiveConversation();

  const convs = convsQuery.data?.data ?? [];
  const messages = msgsQuery.data?.messages ?? [];

  async function handleSend() {
    if (!selectedConv?.id || !selectedConv.accountId || !messageText.trim()) return;
    setSendError(null);
    try {
      await sendMutation.mutateAsync({
        conversationId: selectedConv.id,
        accountId: selectedConv.accountId,
        message: messageText.trim(),
      });
      setMessageText("");
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.includes("2534022") || msg.toLowerCase().includes("allowed window") || msg.toLowerCase().includes("24 hour")) {
        setSendError("Meta's 24-hour messaging window has closed for this conversation. The person needs to message you again before you can reply.");
      } else {
        setSendError(msg || "Failed to send message.");
      }
    }
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
      {/* Left: conversation list */}
      <div className="w-80 shrink-0 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {profiles.length > 1 && (
            <Select value={profileId ?? "all"} onValueChange={(v) => setProfileId(v === "all" ? undefined : v)}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue placeholder="Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All profiles</SelectItem>
                {profiles.map((p: any) => (
                  <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>{getPlatformName(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-7 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {convsQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1"><Skeleton className="h-3 w-24 mb-1" /><Skeleton className="h-3 w-full" /></div>
              </div>
            ))
          ) : !convs.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No {status} conversations.
            </div>
          ) : (
            convs.map((conv) => (
              <button
                key={conv.id}
                onClick={() => { setSelectedConv(conv); setSendError(null); setMessageText(""); }}
                className={cn(
                  "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                  selectedConv?.id === conv.id && "bg-muted"
                )}
              >
                <div className="flex items-start gap-2">
                  {conv.participantPicture ? (
                    <img src={conv.participantPicture} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium">
                      {(conv.participantName ?? "?")[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-medium truncate flex-1">{conv.participantName ?? "Unknown"}</p>
                      {(conv.unreadCount ?? 0) > 0 && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4">{conv.unreadCount}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <PlatformIcon platform={conv.platform as any} className="h-3 w-3" />
                      <span className="text-[10px] text-muted-foreground">{conv.accountUsername}</span>
                      {conv.updatedTime && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDistanceToNow(parseISO(conv.updatedTime), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: message thread */}
      <div className="flex-1 flex flex-col rounded-lg border border-border overflow-hidden">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation to view messages.
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-border p-3 flex items-center gap-2 shrink-0">
              {selectedConv.participantPicture ? (
                <img src={selectedConv.participantPicture} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {(selectedConv.participantName ?? "?")[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{selectedConv.participantName}</p>
                <div className="flex items-center gap-1">
                  <PlatformIcon platform={selectedConv.platform as any} className="h-3 w-3" />
                  <span className="text-xs text-muted-foreground">{selectedConv.accountUsername}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => archiveMutation.mutate({
                  conversationId: selectedConv.id!,
                  accountId: selectedConv.accountId!,
                  status: selectedConv.status === "archived" ? "active" : "archived",
                })}
              >
                {selectedConv.status === "archived" ? (
                  <><RotateCcw className="h-3 w-3" /> Restore</>
                ) : (
                  <><Archive className="h-3 w-3" /> Archive</>
                )}
              </Button>
              {selectedConv.url && (
                <a href={selectedConv.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {msgsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                    <Skeleton className="h-10 w-48 rounded-xl" />
                  </div>
                ))
              ) : msgsQuery.isError ? (
                <div className="text-center text-sm text-muted-foreground py-8 px-4">
                  <p className="text-destructive font-medium mb-1">Could not load messages</p>
                  <p className="text-xs opacity-70">{(msgsQuery.error as any)?.message ?? "Unknown error"}</p>
                  <button
                    className="mt-3 text-xs underline"
                    onClick={() => msgsQuery.refetch()}
                  >
                    Retry
                  </button>
                </div>
              ) : !messages.length ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No messages yet.
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex", msg.direction === "outgoing" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[72%] rounded-2xl px-3 py-2 text-sm",
                        msg.direction === "outgoing"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      {/* Reply/context labels */}
                      {msg.isStoryMention && (
                        <p className="text-[10px] font-semibold mb-1 opacity-80 flex items-center gap-1">
                          <span>📸</span> Story mention
                        </p>
                      )}
                      {msg.storyReply && !msg.isStoryMention && (
                        <p className="text-[10px] font-semibold mb-1 opacity-80 flex items-center gap-1">
                          <span>↩️</span> Reply to your story
                        </p>
                      )}
                      {msg.subject && (
                        <p className="text-[10px] font-semibold mb-1 opacity-80 truncate">
                          Re: {msg.subject}
                        </p>
                      )}
                      {msg.senderName && msg.direction === "incoming" && (
                        <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.senderName}</p>
                      )}
                      {msg.message}
                      {msg.attachments?.map((att) => (
                        att.url && (
                          <div key={att.id} className="mt-1">
                            {att.type === "image" || att.type === "sticker" ? (
                              <img src={att.previewUrl ?? att.url} alt="" className="rounded max-w-[200px]" />
                            ) : att.type === "video" ? (
                              <video
                                src={att.url}
                                poster={att.previewUrl ?? undefined}
                                controls
                                className="rounded max-w-[240px]"
                              />
                            ) : att.type === "audio" ? (
                              <audio src={att.url} controls className="max-w-[240px]" />
                            ) : (
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-80">
                                {att.filename ?? att.type}
                              </a>
                            )}
                          </div>
                        )
                      ))}
                      {msg.createdAt && (
                        <p className="text-[10px] mt-1 opacity-60">
                          {formatDistanceToNow(parseISO(msg.createdAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border shrink-0">
              {sendError && (
                <div className="px-3 pt-3">
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive leading-snug">
                    {sendError}
                  </div>
                </div>
              )}
              <div className="p-3 flex gap-2">
              <Textarea
                placeholder={isWindowClosed ? "Messaging window closed — waiting for a reply…" : "Write a message…"}
                className="min-h-[56px] resize-none text-sm flex-1"
                value={messageText}
                disabled={isWindowClosed}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <Button
                size="icon"
                className="shrink-0 h-auto self-end"
                disabled={isWindowClosed || !messageText.trim() || sendMutation.isPending}
                onClick={handleSend}
              >
                <Send className="h-4 w-4" />
              </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function InboxPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage comments and direct messages across your connected accounts.
        </p>
      </div>

      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Comments
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Messages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="mt-4">
          <CommentsTab />
        </TabsContent>

        <TabsContent value="conversations" className="mt-4">
          <ConversationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
