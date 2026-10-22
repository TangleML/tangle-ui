import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamResolution } from "@/services/teams/types";

import { createSecretArgument, type Secret } from "./types";
import { useMissingSecrets } from "./useMissingSecrets";

const { fetchSecrets } = vi.hoisted(() => ({ fetchSecrets: vi.fn() }));

vi.mock("./secretsStorage", () => ({
  secretsListQuery: (teamId?: string) => ({
    queryKey: ["secrets", teamId ?? "user"],
    queryFn: () => fetchSecrets(teamId),
  }),
}));

const TEAM = { id: "ml-team@example.com", label: "ML Research" };
const ACTIVE: TeamResolution = {
  status: "active",
  team: { ...TEAM, canWrite: true },
};

const secret = (name: string): Secret => ({
  id: name,
  name,
  createdAt: new Date("2026-10-01T09:00:00Z"),
  updatedAt: new Date("2026-10-02T09:00:00Z"),
});

const usingSecrets = (...names: string[]) =>
  Object.fromEntries(names.map((name) => [name, createSecretArgument(name)]));

function check(resolution: TeamResolution, sources: unknown[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderHook(() => useMissingSecrets(resolution, sources), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useMissingSecrets", () => {
  beforeEach(() => {
    fetchSecrets.mockResolvedValue([secret("API_KEY")]);
  });

  afterEach(() => vi.clearAllMocks());

  it("names the referenced secrets the team doesn't have", async () => {
    const { result } = check(ACTIVE, [usingSecrets("API_KEY", "DB_PASSWORD")]);

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.missing).toEqual(["DB_PASSWORD"]);
    expect(fetchSecrets).toHaveBeenCalledWith(TEAM.id);
  });

  it("checks your own secrets when the run falls back to you", async () => {
    const { result } = check({ status: "not-member", team: TEAM }, [
      usingSecrets("API_KEY"),
    ]);

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.missing).toEqual([]);
    expect(fetchSecrets).toHaveBeenCalledWith(undefined);
  });

  it("checks nothing for a run that uses no secrets", () => {
    const { result } = check(ACTIVE, [{ greeting: "hello" }]);

    expect(result.current).toEqual({ missing: [], isChecking: false });
    expect(fetchSecrets).not.toHaveBeenCalled();
  });

  it("waits for the team before checking", () => {
    const { result } = check({ status: "resolving" }, [
      usingSecrets("API_KEY"),
    ]);

    expect(result.current).toEqual({ missing: [], isChecking: true });
    expect(fetchSecrets).not.toHaveBeenCalled();
  });

  it("checks nothing for projects on different teams", () => {
    const { result } = check(
      {
        status: "conflict",
        teams: [TEAM, { id: "data@example.com", label: "Data" }],
      },
      [usingSecrets("API_KEY")],
    );

    expect(result.current).toEqual({ missing: [], isChecking: false });
    expect(fetchSecrets).not.toHaveBeenCalled();
  });

  it("names nothing when the secrets can't be listed", async () => {
    fetchSecrets.mockRejectedValue(new Error("backend down"));

    const { result } = check(ACTIVE, [usingSecrets("API_KEY")]);

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.missing).toEqual([]);
  });
});
