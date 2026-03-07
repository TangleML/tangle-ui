import { Link } from "@/components/ui/link";
import type { LinkBlockProperties, QueryParam } from "@/types/composerSchema";
import { QueryParamType } from "@/types/composerSchema";

export function buildUrl(
  urlTemplate: string,
  queryParams?: Record<string, QueryParam>,
): string {
  let url = urlTemplate;
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    for (const [key, param] of Object.entries(queryParams)) {
      params.set(
        key,
        param.type === QueryParamType.Json
          ? JSON.stringify(param.value)
          : param.value,
      );
    }
    url = `${url}?${params.toString()}`;
  }
  return url;
}

export const LinkBlock = ({
  title,
  urlTemplate,
  queryParams,
}: LinkBlockProperties) => {
  if (!title) {
    console.warn("LinkBlock: missing title, falling back to raw URL");
  }

  const href = buildUrl(urlTemplate, queryParams);

  return (
    <Link href={href} external size="sm">
      {title ?? href}
    </Link>
  );
};
