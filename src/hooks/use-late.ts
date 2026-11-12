import { useMemo } from "react";
import Late from "@getlatedev/node";
import { useAuthStore } from "@/stores";

/**
 * Hook to get a Late client instance using the stored API key.
 * Returns null if no API key is available.
 */
export function useLate(): Late | null {
  const { apiKey } = useAuthStore();

  const client = useMemo(() => {
    if (!apiKey) return null;
    return new Late({ apiKey });
  }, [apiKey]);

  return client;
}

/**
 * Hook that throws if no Late client is available.
 * Use this in authenticated pages where you expect the API key to exist.
 */
export function useLateClient(): Late {
  const client = useLate();
  if (!client) {
    throw new Error("Late client not available. Please connect your API key.");
  }
  return client;
}
