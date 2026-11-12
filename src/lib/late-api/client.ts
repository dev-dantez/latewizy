import Late from "@getlatedev/node";

// Create a Late client instance
// For server-side: uses LATE_API_KEY env var
// For client-side: pass API key explicitly
export function createLateClient(apiKey?: string): Late {
  const key = apiKey || process.env.LATE_API_KEY;

  if (!key) {
    throw new Error(
      "Zernio API key is required. Set LATE_API_KEY environment variable or pass it explicitly."
    );
  }

  return new Late({
    apiKey: key,
  });
}

// Singleton for server-side usage with env var
let serverClient: Late | null = null;

export function getServerClient(): Late {
  if (!serverClient) {
    serverClient = createLateClient();
  }
  return serverClient;
}
