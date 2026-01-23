import { QueryCache, QueryClient } from "@tanstack/react-query";

import { errorReporter } from "@/services/errorManagement";

/**
 * Creates and configures the React Query client with error reporting.
 * All React Query errors are automatically reported to Bugsnag.
 */
export const createQueryClient = () => {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        const originalError = error as Error;

        // Convert query key to a readable string
        const queryKeyStr = JSON.stringify(query.queryKey);

        // Create a more descriptive error with query context
        const contextualError = new Error(
          `React Query Error [${queryKeyStr}]: ${originalError.message}`,
        );

        // Preserve the original stack trace
        contextualError.stack = originalError.stack;

        // Report to Bugsnag
        errorReporter.report(contextualError, {
          metadata: {
            type: "react_query_error",
            originalMessage: originalError.message,
          },
        });
      },
    }),
  });
};
