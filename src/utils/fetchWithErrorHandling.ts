/**
 * Fetch wrapper that provides better error messages.
 * Errors are caught and reported by React Query's onError handler and error boundaries.
 */
export const fetchWithErrorHandling = async (
  input: RequestInfo | URL,
  options?: RequestInit,
): Promise<Response> => {
  // Extract the URL string for error messages
  const urlString =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  let response: Response;

  try {
    response = await fetch(input, options);
  } catch (fetchError) {
    const message =
      fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new Error(`Network error: ${message} (URL: ${urlString})`);
  }

  if (!response.ok) {
    let message = response.statusText || "No error details";
    try {
      // Clone the response so we can read the body for error message
      const clonedResponse = response.clone();
      let errorBody: any;
      if (
        clonedResponse.headers.get("content-type")?.includes("application/json")
      ) {
        errorBody = await clonedResponse.json();
      } else {
        errorBody = await clonedResponse.text();
      }
      message = errorBody.message || errorBody || message;
    } catch {
      // Ignore if we can't read the error body
    }

    if (response.status === 403) {
      throw new Error(message || "Access denied (403)");
    }

    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${message} (URL: ${urlString})`,
    );
  }

  return response;
};
