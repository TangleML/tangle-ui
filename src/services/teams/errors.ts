import { ApiError } from "@/services/projects/errors";
import { describeErrorBody } from "@/services/requestFailureMessage";

const IMPERSONATION_REFUSAL_PREFIX = "Impersonation error:";

export class TeamIdentityError extends ApiError {
  constructor(message: string, status: number) {
    super("TeamIdentityError", message, status);
  }
}

export class TeamImpersonationError extends ApiError {
  constructor(message: string, status: number) {
    super("TeamImpersonationError", message, status);
  }
}

export function readImpersonationRefusal(body: unknown): string | undefined {
  const reason = describeErrorBody(body);
  return reason?.startsWith(IMPERSONATION_REFUSAL_PREFIX) ? reason : undefined;
}
