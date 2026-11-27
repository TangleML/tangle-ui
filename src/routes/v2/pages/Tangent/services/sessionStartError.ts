import { TANGENT_BUNDLE_ID } from "@/routes/v2/pages/Tangent/constants";
import { getErrorMessage, safeJsonParse } from "@/utils/string";
import { isRecord } from "@/utils/typeGuards";

const MISSING_BUNDLE = "Agent bundle not found";

// Tangent's runtime throws the response body as the message, so a refusal
// arrives as `{"error":"…"}` rather than as the sentence inside it.
function tangentMessage(error: unknown): string {
  const message = getErrorMessage(error);
  const { parsed } = safeJsonParse(message);
  return isRecord(parsed) && typeof parsed.error === "string"
    ? parsed.error
    : message;
}

export function isMissingBundleError(error: unknown): boolean {
  return tangentMessage(error) === MISSING_BUNDLE;
}

export function describeSessionStartError(error: unknown): string {
  if (isMissingBundleError(error)) {
    return `This Tangent server doesn't have the "${TANGENT_BUNDLE_ID}" agent bundle installed.`;
  }
  return tangentMessage(error);
}
