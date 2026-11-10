export function tangentUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

export function tangentSessionUrl(
  baseUrl: string,
  sessionId: string,
  rest?: string,
): string {
  const session = `/api/sessions/${encodeURIComponent(sessionId)}`;
  return tangentUrl(baseUrl, rest ? `${session}/${rest}` : session);
}

export function tangentAuthHeaders(
  authToken: string | undefined,
): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}
