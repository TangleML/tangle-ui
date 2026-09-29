import { DEV_TANGENT_BASE_URL } from "@/routes/v2/pages/Tangent/constants";
import { isRecord } from "@/utils/typeGuards";

export interface TangentBaseUrlResolution {
  baseUrl: string | null;
  localAddress: string | null;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/**
 * The set Chrome gates behind its Local Network Access permission: loopback,
 * the private IPv4 ranges, link-local, and `.local` names. Tangent is deployed
 * alongside Tangle, so in a build none of these can be a real Tangent — they
 * are only ever a workspace still holding a developer's address, and fetching
 * one would put a permission prompt in front of every first-time visitor.
 */
function isLocalNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;

  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fe80:") || /^f[cd]/.test(host);
  }

  const octets = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!octets) return false;

  const first = Number(octets[1]);
  const second = Number(octets[2]);
  return (
    first === 0 ||
    first === 127 ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function isLocalNetworkAddress(url: string): boolean {
  try {
    return isLocalNetworkHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function unconfigured(): TangentBaseUrlResolution {
  return {
    baseUrl: import.meta.env.DEV ? DEV_TANGENT_BASE_URL : null,
    localAddress: null,
  };
}

export function resolveTangentBaseUrl(
  metadata: Record<string, unknown> | null | undefined,
): TangentBaseUrlResolution {
  if (!isRecord(metadata)) return unconfigured();
  const { tangentBaseUrl } = metadata;
  if (typeof tangentBaseUrl !== "string") return unconfigured();

  const normalized = normalizeBaseUrl(tangentBaseUrl);
  if (normalized.length === 0) return unconfigured();

  if (!import.meta.env.DEV && isLocalNetworkAddress(normalized)) {
    return { baseUrl: null, localAddress: normalized };
  }

  return { baseUrl: normalized, localAddress: null };
}
