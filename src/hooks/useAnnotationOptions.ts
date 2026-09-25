import { useQuery } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import type { AnnotationOption, Annotations } from "@/types/annotations";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

const PLACEHOLDER = /\{([^}]+)\}/g;
const STALE_TIME = 5 * 60 * 1000;

type RemoteOption =
  string | { value: string; name?: string; label?: string; caption?: string };

// Backend-relative only: an absolute URL would carry the session elsewhere.
export function resolveOptionsUrl(
  template: string,
  annotations: Annotations,
): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(template) || template.startsWith("//")) {
    return undefined;
  }
  let complete = true;
  const resolved = template.replace(PLACEHOLDER, (_, key: string) => {
    const value = annotations[key];
    if (value === undefined || value === null || value === "") {
      complete = false;
      return "";
    }
    return encodeURIComponent(String(value));
  });
  return complete ? resolved : undefined;
}

export function toAnnotationOptions(payload: unknown): AnnotationOption[] {
  if (!Array.isArray(payload)) return [];
  return (payload as RemoteOption[]).flatMap((item) => {
    if (typeof item === "string") return [{ value: item, name: item }];
    if (item && typeof item.value === "string") {
      return [
        {
          value: item.value,
          name: item.name ?? item.label ?? item.value,
          ...(item.caption ? { caption: item.caption } : {}),
        },
      ];
    }
    return [];
  });
}

export function useAnnotationOptions(
  optionsUrl: string | undefined,
  annotations: Annotations,
) {
  const { backendUrl, configured, available } = useBackend();
  const path = optionsUrl
    ? resolveOptionsUrl(optionsUrl, annotations)
    : undefined;

  return useQuery<AnnotationOption[]>({
    queryKey: ["annotationOptions", backendUrl, path],
    enabled: !!path && configured && available,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () =>
      toAnnotationOptions(
        await fetchWithErrorHandling(new URL(path!, backendUrl).toString()),
      ),
  });
}
