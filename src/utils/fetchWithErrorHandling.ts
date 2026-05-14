export class RemoteAuthError extends Error {
  constructor(public readonly url: string) {
    super(
      `Request to ${url} was intercepted by a remote authentication service.`,
    );
    this.name = "RemoteAuthError";
    Object.setPrototypeOf(this, RemoteAuthError.prototype);
  }
}

export const fetchWithErrorHandling = async (
  url: string,
  options?: RequestInit,
): Promise<any> => {
  let response: Response;

  try {
    response = await fetch(url, { redirect: "manual", ...options });
  } catch (fetchError) {
    const message =
      fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new Error(`Network error: ${message} (URL: ${url})`);
  }

  if (response.type === "opaqueredirect") {
    throw new RemoteAuthError(url);
  }

  if (!response.ok) {
    let message = "No error details";
    try {
      let errorBody: any;
      if (response.headers.get("content-type")?.includes("application/json")) {
        errorBody = await response.json();
      } else {
        errorBody = await response.text();
      }
      message = errorBody.message;
    } catch {
      // Ignore if we can't read the error body
    }

    if (response.status === 403) {
      throw new Error(message || "Access denied (403)");
    }

    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${message} (URL: ${url})`,
    );
  }

  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");

  if (!contentType || contentLength === "0") {
    return response;
  }

  if (contentType?.includes("application/json")) {
    try {
      return await response.json();
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`Invalid JSON response: ${message} (URL: ${url})`);
    }
  }

  return response;
};
