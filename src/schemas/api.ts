import { z } from "zod";

export const ContainerExecutionStatusSchema = z.enum([
  "INVALID",
  "UNINITIALIZED",
  "QUEUED",
  "WAITING_FOR_UPSTREAM",
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SYSTEM_ERROR",
  "CANCELLING",
  "CANCELLED",
  "SKIPPED",
]);

/** Schema for the response from POST /api/pipeline_runs/ */
export const CreatePipelineRunResponseSchema = z.object({
  id: z.number(),
  root_execution_id: z.number(),
  created_at: z.string(),
  created_by: z.string(),
});

/** Schema for OAuth token exchange response */
export const OasisAuthResponseSchema = z.object({
  token: z.string(),
  token_type: z.literal("JWT"),
});

/** Schema for JWT payload parsed from token - user_id coerces to string since JWTs may encode it as a number */
export const JWTPayloadSchema = z.object({
  user_id: z.union([z.string(), z.number()]).transform(String),
  login: z.string(),
  avatar_url: z.string(),
  exp: z.number(),
  auth_provider: z.enum(["github", "minerva", "huggingface"]).or(z.undefined()),
});

/** Schema for container execution logs */
export const ContainerLogResponseSchema = z.object({
  log_text: z.string().optional(),
  system_error_exception_full: z.string().optional(),
});
