// Shared so the run-create mutation paths can invalidate the same query the
// onboarding checklist reads to derive its `execute_run` step. Kept dependency
// free so submitters can import it without pulling in the provider tree.
export const ONBOARDING_MY_RUN_COUNT_KEY = [
  "onboarding",
  "myRunCount",
] as const;
