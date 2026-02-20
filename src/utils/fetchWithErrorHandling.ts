import type { z } from "zod";

export async function fetchWithErrorHandling<T>(
  url: string,
  options: RequestInit | undefined,
  schema: z.ZodType<T>,
): Promise<T>;

export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit,
): Promise<any>;
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit,
  schema?: z.ZodType,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, options);
  } catch (fetchError) {
    const message =
      fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new Error(`Network error: ${message} (URL: ${url})`);
  }

  if (!response.ok) {
    let message = "No error details";
    try {
      let errorBody: unknown;
      if (response.headers.get("content-type")?.includes("application/json")) {
        errorBody = await response.json();
      } else {
        errorBody = await response.text();
      }
      if (
        typeof errorBody === "object" &&
        errorBody !== null &&
        "message" in errorBody
      ) {
        message = String((errorBody as { message: unknown }).message);
      }
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
      const json: unknown = await response.json();
      return schema ? schema.parse(json) : json;
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(`Invalid JSON response: ${message} (URL: ${url})`);
    }
  }

  return response;
}
