/**
 * Inbox Hooks — Comments & Conversations
 *
 * Wraps the @getlatedev/node SDK inbox methods via TanStack Query.
 * SDK verified call signatures used throughout.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLate } from "./use-late";

// ============================================================================
// Query keys
// ============================================================================

export const inboxKeys = {
  comments: (params: object) => ["inbox", "comments", params] as const,
  postComments: (postId: string) => ["inbox", "post-comments", postId] as const,
  conversations: (params: object) => ["inbox", "conversations", params] as const,
  conversation: (id: string) => ["inbox", "conversation", id] as const,
  messages: (id: string) => ["inbox", "messages", id] as const,
};

// ============================================================================
// Comment types
// ============================================================================

export interface CommentItem {
  id?: string;
  platform?: string;
  accountId?: string;
  accountUsername?: string;
  content?: string;
  picture?: string | null;
  permalink?: string | null;
  createdTime?: string;
  commentCount?: number;
  likeCount?: number;
  cid?: string | null;
  subreddit?: string | null;
}

export interface PostComment {
  id?: string;
  message?: string;
  createdTime?: string;
  from?: {
    id?: string;
    name?: string;
    username?: string;
    picture?: string | null;
    isOwner?: boolean;
  };
  likeCount?: number;
  hidden?: boolean;
  replies?: PostComment[];
}

export interface ConversationItem {
  id?: string;
  platform?: string;
  accountId?: string;
  accountUsername?: string;
  participantId?: string;
  participantName?: string;
  participantPicture?: string | null;
  lastMessage?: string;
  updatedTime?: string;
  status?: "active" | "archived";
  unreadCount?: number | null;
  url?: string | null;
}

export interface ConversationMessage {
  id?: string;
  conversationId?: string;
  accountId?: string;
  platform?: string;
  message?: string;
  senderId?: string;
  senderName?: string | null;
  direction?: "incoming" | "outgoing";
  createdAt?: string;
  subject?: string | null;
  storyReply?: boolean | null;
  isStoryMention?: boolean | null;
  attachments?: Array<{
    id?: string;
    type?: "image" | "video" | "audio" | "file" | "sticker" | "share";
    url?: string;
    filename?: string | null;
    previewUrl?: string | null;
  }>;
}

// ============================================================================
// Comments — list posts with comments
// ============================================================================

export interface CommentsFilter {
  profileId?: string;
  accountId?: string;
  platform?: string;
  since?: string;
  sortBy?: "date" | "comments";
  sortOrder?: "asc" | "desc";
  limit?: number;
  cursor?: string;
}

export function useInboxComments(filter: CommentsFilter) {
  const late = useLate();

  return useQuery({
    queryKey: inboxKeys.comments(filter),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.comments.listInboxComments({
        query: {
          profileId: filter.profileId,
          accountId: filter.accountId,
          platform: filter.platform as any,
          since: filter.since,
          sortBy: (filter.sortBy ?? "date") as any,
          sortOrder: (filter.sortOrder ?? "desc") as any,
          limit: filter.limit ?? 20,
          cursor: filter.cursor,
        },
      });
      if (error) throw error;
      return data as { data?: CommentItem[]; pagination?: { hasMore?: boolean; nextCursor?: string | null } };
    },
    enabled: !!late,
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================================================
// Post-level comments
// ============================================================================

export function usePostComments(postId: string) {
  const late = useLate();

  return useQuery({
    queryKey: inboxKeys.postComments(postId),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.comments.getInboxPostComments({
        path: { postId },
      });
      if (error) throw error;
      return data as { status?: string; comments?: PostComment[] };
    },
    enabled: !!late && !!postId,
    staleTime: 60 * 1000,
  });
}

// ============================================================================
// Comment actions
// ============================================================================

export function useReplyToPost() {
  const late = useLate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      postId: string;
      accountId: string;
      message: string;
      commentId?: string;
    }) => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.comments.replyToInboxPost({
        path: { postId: vars.postId },
        body: {
          accountId: vars.accountId,
          message: vars.message,
          commentId: vars.commentId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: inboxKeys.postComments(vars.postId) });
      qc.invalidateQueries({ queryKey: ["inbox", "comments"] });
    },
  });
}

export function useHideComment() {
  const late = useLate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { postId: string; commentId: string; accountId: string }) => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.comments.hideInboxComment({
        path: { postId: vars.postId, commentId: vars.commentId },
        body: { accountId: vars.accountId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: inboxKeys.postComments(vars.postId) });
    },
  });
}

export function useUnhideComment() {
  const late = useLate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { postId: string; commentId: string }) => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.comments.unhideInboxComment({
        path: { postId: vars.postId, commentId: vars.commentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: inboxKeys.postComments(vars.postId) });
    },
  });
}

export function useLikeComment() {
  const late = useLate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { postId: string; commentId: string; accountId: string; cid?: string }) => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.comments.likeInboxComment({
        path: { postId: vars.postId, commentId: vars.commentId },
        body: { accountId: vars.accountId, cid: vars.cid },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: inboxKeys.postComments(vars.postId) });
    },
  });
}

export function useUnlikeComment() {
  const late = useLate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { postId: string; commentId: string }) => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.comments.unlikeInboxComment({
        path: { postId: vars.postId, commentId: vars.commentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: inboxKeys.postComments(vars.postId) });
    },
  });
}

export function useDeleteComment() {
  const late = useLate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { postId: string; commentId: string; accountId: string }) => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.comments.deleteInboxComment({
        path: { postId: vars.postId },
        query: { commentId: vars.commentId, accountId: vars.accountId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox", "comments"] });
    },
  });
}

// ============================================================================
// Conversations
// ============================================================================

export interface ConversationsFilter {
  profileId?: string;
  accountId?: string;
  platform?: string;
  status?: "active" | "archived";
  limit?: number;
  cursor?: string;
}

export function useInboxConversations(filter: ConversationsFilter) {
  const late = useLate();

  return useQuery({
    queryKey: inboxKeys.conversations(filter),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.messages.listInboxConversations({
        query: {
          profileId: filter.profileId,
          accountId: filter.accountId,
          platform: filter.platform as any,
          status: filter.status ?? "active",
          limit: filter.limit ?? 25,
          cursor: filter.cursor,
          sortOrder: "desc",
        },
      });
      if (error) throw error;
      return data as { data?: ConversationItem[]; pagination?: { hasMore?: boolean; nextCursor?: string | null } };
    },
    enabled: !!late,
    staleTime: 60 * 1000,
  });
}

export function useConversationMessages(conversationId: string, accountId?: string) {
  const late = useLate();

  return useQuery({
    queryKey: inboxKeys.messages(conversationId),
    queryFn: async () => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.messages.getInboxConversationMessages({
        path: { conversationId },
        query: { accountId },
      });
      if (error) throw error;
      return data as { messages?: ConversationMessage[]; lastUpdated?: string };
    },
    enabled: !!late && !!conversationId && !!accountId,
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useSendMessage() {
  const late = useLate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      conversationId: string;
      accountId: string;
      message: string;
    }) => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.messages.sendInboxMessage({
        path: { conversationId: vars.conversationId },
        body: { accountId: vars.accountId, message: vars.message },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: inboxKeys.messages(vars.conversationId) });
      qc.invalidateQueries({ queryKey: ["inbox", "conversations"] });
    },
  });
}

export function useArchiveConversation() {
  const late = useLate();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      conversationId: string;
      accountId: string;
      status: "active" | "archived";
    }) => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.messages.updateInboxConversation({
        path: { conversationId: vars.conversationId },
        body: { accountId: vars.accountId, status: vars.status },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox", "conversations"] });
    },
  });
}
