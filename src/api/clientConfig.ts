import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

import { client } from "./client.gen";

/**
 * Configure the API client to use fetchWithErrorHandling for better error messages.
 * Errors are automatically caught and reported by React Query's onError handler.
 */
client.setConfig({
  fetch: fetchWithErrorHandling as unknown as typeof fetch,
});
