import { useSuspenseQuery } from "@tanstack/react-query";

import { HOURS } from "@/utils/constants";

/**
 * Fetches artifact content from a signed URL using suspense mode.
 * Loading and error states are handled by the nearest SuspenseWrapper.
 */
export function useArtifactFetch<T>(
  queryKey: string,
  signedUrl: string,
  transform: (response: Response) => Promise<T>,
): T {
  const { data } = useSuspenseQuery({
    queryKey: [`artifact-${queryKey}`, signedUrl],
    queryFn: async () => {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`(${response.status}) Failed to fetch artifact.`);
      }

      return transform(response);
    },
    staleTime: 24 * HOURS,
    retry: false,
  });

  return data;
}
