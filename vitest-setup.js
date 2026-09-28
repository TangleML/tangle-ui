import "@testing-library/jest-dom/vitest";

import { afterEach, beforeEach, vi } from "vitest";

// Keep developer-local proxy connections and credentials out of unit tests.
beforeEach(() => {
  vi.stubEnv("VITE_OPENAI_API_BASE", "");
  vi.stubEnv("VITE_OPENAI_API_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());
