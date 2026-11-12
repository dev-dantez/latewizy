import { useMutation } from "@tanstack/react-query";
import { useLate } from "./use-late";

export interface UploadedMedia {
  url: string;
  type: "image" | "video";
  filename: string;
  contentType: string;
}

/**
 * Hook to get a presigned URL for media upload
 */
export function useMediaPresign() {
  const late = useLate();

  return useMutation({
    mutationFn: async ({
      filename,
      contentType,
    }: {
      filename: string;
      contentType: string;
    }) => {
      if (!late) throw new Error("Not authenticated");
      const { data, error } = await late.media.getMediaPresignedUrl({
        body: { filename, contentType },
      });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Hook to upload media using presigned URL
 */
export function useUploadMedia() {
  const presignMutation = useMediaPresign();

  return useMutation({
    mutationFn: async (file: File): Promise<UploadedMedia> => {
      // Get presigned URL
      const presignData = await presignMutation.mutateAsync({
        filename: file.name,
        contentType: file.type,
      });

      if (!presignData?.uploadUrl || !presignData?.publicUrl) {
        throw new Error("Failed to get upload URL");
      }

      // Upload file to presigned URL
      const uploadResponse = await fetch(presignData.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Determine media type
      const type: "image" | "video" = file.type.startsWith("video/")
        ? "video"
        : "image";

      return {
        url: presignData.publicUrl,
        type,
        filename: file.name,
        contentType: file.type,
      };
    },
  });
}

/**
 * Hook to upload multiple files
 */
export function useUploadMultipleMedia() {
  const uploadMutation = useUploadMedia();

  return useMutation({
    mutationFn: async (files: File[]): Promise<UploadedMedia[]> => {
      const results = await Promise.all(
        files.map((file) => uploadMutation.mutateAsync(file))
      );
      return results;
    },
  });
}

/**
 * Utility to get file type from MIME type
 */
export function getMediaType(mimeType: string): "image" | "video" {
  return mimeType.startsWith("video/") ? "video" : "image";
}

/**
 * Utility to validate file type
 */
export function isValidMediaType(file: File): boolean {
  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
  ];
  return validTypes.includes(file.type);
}

/**
 * Utility to get max file size by type (in bytes)
 */
export function getMaxFileSize(type: "image" | "video"): number {
  // 10MB for images, 5GB for videos
  return type === "video" ? 5 * 1024 * 1024 * 1024 : 10 * 1024 * 1024;
}
