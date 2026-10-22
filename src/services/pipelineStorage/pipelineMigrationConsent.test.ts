import { afterEach, expect, it } from "vitest";

import {
  hasPipelineMigrationConsent,
  pipelineMigrationConsentKey,
  revokePipelineMigrationConsent,
} from "./pipelineMigrationConsent";

afterEach(() => localStorage.clear());
it("shares consent across equivalent URL spellings and revokes historical keys", () => {
  const canonical = "https://backend.example.com";
  const old = "https://BACKEND.example.com:443/";
  localStorage.setItem(`local-pipeline-migration-consent-v1:${old}`, "true");
  expect(pipelineMigrationConsentKey(old)).toBe(
    pipelineMigrationConsentKey(canonical),
  );
  expect(hasPipelineMigrationConsent(canonical)).toBe(true);
  revokePipelineMigrationConsent(canonical);
  expect(hasPipelineMigrationConsent(old)).toBe(false);
  expect(localStorage.length).toBe(0);
});
