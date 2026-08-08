import { useSuspenseQuery } from "@tanstack/react-query";

import { ArtifactFetchError } from "@/services/executionService";
import { HOURS } from "@/utils/constants";

export const fetchArtifactOrThrow: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new ArtifactFetchError(
      response.status,
      response.statusText,
      "Failed to fetch artifact.",
    );
  }
  return response;
};

export const fetchArtifactForHyparquet: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.ok) return response;

  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "HEAD" && response.status === 403) {
    return response;
  }

  throw new ArtifactFetchError(
    response.status,
    response.statusText,
    "Failed to fetch artifact.",
  );
};

export function useArtifactFetch<T>(
  queryKey: string,
  signedUrl: string,
  transform: (response: Response) => Promise<T>,
): T {
  const { data } = useSuspenseQuery({
    queryKey: [`artifact-${queryKey}`, signedUrl],
    queryFn: async () => {
      const response = await fetchArtifactOrThrow(signedUrl);
      return transform(response);
    },
    staleTime: 24 * HOURS,
    retry: false,
  });

  return data;
}
