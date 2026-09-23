import { isRecord } from "@/utils/typeGuards";

export function throwIfIncompleteAiResponse(payload: unknown): void {
  if (!isRecord(payload) || payload.status !== "incomplete") return;

  const reason = isRecord(payload.incomplete_details)
    ? payload.incomplete_details.reason
    : undefined;
  throw new Error(
    reason === "max_output_tokens"
      ? "AI response reached the provider's output limit before finishing. Check the provider's token limit and try again."
      : "AI provider returned an incomplete response. Please try again.",
  );
}
