import { z } from "zod";

const booleanString = z
  .string()
  .optional()
  .default("")
  .transform((v) => v === "true");

/**
 * Schema for all VITE_* environment variables used by the app.
 * Parsed once at startup so the rest of the codebase works with typed values.
 */
const EnvSchema = z.object({
  VITE_ABOUT_URL: z.string().optional().default("https://tangleml.com/"),
  VITE_GIVE_FEEDBACK_URL: z
    .string()
    .optional()
    .default("https://github.com/TangleML/tangle/issues"),
  VITE_PRIVACY_POLICY_URL: z
    .string()
    .optional()
    .default("https://tangleml.com/docs/privacy_policy/"),
  VITE_DOCUMENTATION_URL: z
    .string()
    .optional()
    .default("https://tangleml.com/docs/"),
  VITE_BACKEND_API_URL: z.string().optional().default(""),
  VITE_BASE_URL: z.string().optional().default("/"),
  VITE_GITHUB_PAGES: booleanString,
  VITE_GIT_REPO_URL: z
    .string()
    .optional()
    .default("https://github.com/TangleML/tangle-ui"),
  VITE_GIT_COMMIT: z.string().optional().default("master"),
  VITE_DEFAULT_REMOTE_COMPONENT_LIBRARY_BETA: booleanString,
  VITE_ENABLE_GOOGLE_CLOUD_SUBMITTER: booleanString,
  VITE_ENABLE_ROUTER_DEVTOOLS: booleanString,
  VITE_HUGGING_FACE_AUTHORIZATION: booleanString,
  VITE_REQUIRE_AUTHORIZATION: booleanString,
  VITE_GITHUB_CLIENT_ID: z.string().optional().default(""),
  VITE_BUGSNAG_API_KEY: z.string().optional().default(""),
  VITE_BUGSNAG_NOTIFY_ENDPOINT: z
    .string()
    .optional()
    .default("https://notify.bugsnag.com"),
  VITE_BUGSNAG_SESSIONS_ENDPOINT: z
    .string()
    .optional()
    .default("https://sessions.bugsnag.com"),
  VITE_COMPONENT_LIBRARY_URL_DEFAULT_VALUE: z.string().optional().default(""),
  VITE_ENABLE_SCAN: booleanString,
  VITE_BUGSNAG_CUSTOM_GROUPING_KEY: z.string().optional(),
});

type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  return EnvSchema.parse(import.meta.env);
}

/**
 * In test mode, env vars may be stubbed via vi.stubEnv() after module load,
 * so we re-parse on each property access. In production, we parse once.
 */
const isTestMode = import.meta.env.MODE === "test";

export const env: Env = isTestMode
  ? new Proxy({} as Env, {
      get(_target, prop: string) {
        return parseEnv()[prop as keyof Env];
      },
    })
  : parseEnv();
