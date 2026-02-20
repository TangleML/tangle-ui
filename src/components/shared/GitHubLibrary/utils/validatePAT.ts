import { z } from "zod";

const GitHubPATSchema = z
  .string()
  .min(1, "Personal Access Token is required")
  .refine(
    (v) => v.startsWith("ghp_") || v.startsWith("github_pat_"),
    "Invalid Personal Access Token. Must start with ghp_ or github_pat_",
  );

export function validatePAT(token: string): string[] | null {
  const result = GitHubPATSchema.safeParse(token);
  if (result.success) return null;
  return result.error.issues.map((i) => i.message);
}
