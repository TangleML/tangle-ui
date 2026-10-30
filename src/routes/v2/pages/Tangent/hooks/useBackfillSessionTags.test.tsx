import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureSessionTag } from "@/routes/v2/pages/Tangent/services/sessionTags";

import { useBackfillSessionTags } from "./useBackfillSessionTags";

vi.mock("@/routes/v2/pages/Tangent/services/sessionTags", () => ({
  ensureSessionTag: vi.fn(),
}));

const PROJECT_ID = "p1";
const BASE_URL = "http://tangent";
const AUTH_TOKEN = "jwt";
const PROJECT_TAG = "projectId:p1";

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

interface Props {
  sessionIds: string[];
  baseUrl?: string | null;
  authToken?: string;
}

function renderBackfill(client: QueryClient, initialProps: Props) {
  return renderHook(
    ({ sessionIds, baseUrl = BASE_URL, authToken = AUTH_TOKEN }: Props) =>
      useBackfillSessionTags({
        projectId: PROJECT_ID,
        baseUrl,
        authToken,
        sessionIds,
      }),
    { wrapper: wrapperFor(client), initialProps },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("useBackfillSessionTags", () => {
  it("ensures the project tag on each session and refreshes once when a write happened", async () => {
    vi.mocked(ensureSessionTag).mockResolvedValue(true);
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    renderBackfill(client, { sessionIds: ["s1", "s2"] });

    await waitFor(() => expect(ensureSessionTag).toHaveBeenCalledTimes(2));
    expect(ensureSessionTag).toHaveBeenCalledWith({
      baseUrl: BASE_URL,
      sessionId: "s1",
      authToken: AUTH_TOKEN,
      tag: PROJECT_TAG,
    });
    expect(ensureSessionTag).toHaveBeenCalledWith({
      baseUrl: BASE_URL,
      sessionId: "s2",
      authToken: AUTH_TOKEN,
      tag: PROJECT_TAG,
    });

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["tangent", "environments", BASE_URL],
      }),
    );
  });

  it("does not ensure a session it already tagged", async () => {
    vi.mocked(ensureSessionTag).mockResolvedValue(true);
    const client = makeClient();

    const { rerender } = renderBackfill(client, { sessionIds: ["s1", "s2"] });
    await waitFor(() => expect(ensureSessionTag).toHaveBeenCalledTimes(2));

    rerender({ sessionIds: ["s1", "s2", "s3"] });

    await waitFor(() => expect(ensureSessionTag).toHaveBeenCalledTimes(3));
    expect(ensureSessionTag).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionId: "s3" }),
    );
  });

  it("does not refresh when no tag write was needed", async () => {
    vi.mocked(ensureSessionTag).mockResolvedValue(false);
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    renderBackfill(client, { sessionIds: ["s1"] });

    await waitFor(() => expect(ensureSessionTag).toHaveBeenCalledTimes(1));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("does nothing without a base url or auth token", () => {
    const client = makeClient();

    renderBackfill(client, {
      sessionIds: ["s1"],
      baseUrl: null,
      authToken: undefined,
    });

    expect(ensureSessionTag).not.toHaveBeenCalled();
  });
});
