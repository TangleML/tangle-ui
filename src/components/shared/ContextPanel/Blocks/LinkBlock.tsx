import { Link } from "@/components/ui/link";
import type { LinkBlockProperties, QueryParam } from "@/types/composerSchema";
import { QueryParamType } from "@/types/composerSchema";

export function buildUrl(
  urlTemplate: string,
  queryParams?: Record<string, QueryParam>,
): string {
  const url = new URL(urlTemplate);
  if (queryParams) {
    for (const [key, param] of Object.entries(queryParams)) {
      url.searchParams.set(
        key,
        param.type === QueryParamType.Json
          ? JSON.stringify(param.value)
          : param.value,
      );
    }
  }
  return url.toString();
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
