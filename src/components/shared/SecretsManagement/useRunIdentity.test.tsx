import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamResolution } from "@/services/teams/types";

import { runIdentity } from "./runIdentity";
import { createSecretArgument, type Secret, SecretsQueryKeys } from "./types";
import { useRunAsChoice, useRunIdentity } from "./useRunIdentity";

const { fetchSecrets } = vi.hoisted(() => ({ fetchSecrets: vi.fn() }));

vi.mock("./secretsStorage", async () => {
  const { SecretsQueryKeys } = await import("./types");
  return {
    secretsListQuery: (teamId?: string) => ({
      queryKey: SecretsQueryKeys.All(teamId),
      queryFn: () => fetchSecrets(teamId),
    }),
  };
});

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

const testQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

function check(
  resolution: TeamResolution,
  sources: unknown[],
  queryClient = testQueryClient(),
) {
  return renderHook(() => useRunIdentity(resolution, sources), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("useRunIdentity", () => {
  beforeEach(() => {
    fetchSecrets.mockImplementation(async (teamId?: string) =>
      teamId ? [secret("TEAM_KEY")] : [secret("MY_KEY")],
    );
  });

  afterEach(() => vi.clearAllMocks());

  it("checks your secrets and the team's", async () => {
    const { result } = check(ACTIVE, [usingSecrets("MY_KEY", "TEAM_KEY")]);

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.rule).toEqual({
      kind: "split",
      yoursOnly: ["MY_KEY"],
      teamOnly: ["TEAM_KEY"],
    });
    expect(result.current.missing).toEqual({
      you: ["TEAM_KEY"],
      team: ["MY_KEY"],
    });
    expect(fetchSecrets).toHaveBeenCalledWith(undefined);
    expect(fetchSecrets).toHaveBeenCalledWith(TEAM.id);
  });

  it("goes as the team when only the team has a secret", async () => {
    const { result } = check(ACTIVE, [usingSecrets("TEAM_KEY")]);

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.rule).toEqual({
      kind: "team-required",
      teamOnly: ["TEAM_KEY"],
    });
    expect(result.current.team).toEqual(ACTIVE.team);
  });

  it("keeps checking while the team's secrets load, though yours have", async () => {
    let listTeamSecrets: (secrets: Secret[]) => void = () => {};
    fetchSecrets.mockImplementation((teamId?: string) =>
      teamId
        ? new Promise<Secret[]>((resolve) => {
            listTeamSecrets = resolve;
          })
        : Promise.resolve([secret("MY_KEY")]),
    );
    const queryClient = testQueryClient();
    queryClient.setQueryData(SecretsQueryKeys.All(), [secret("MY_KEY")]);

    const { result } = check(ACTIVE, [usingSecrets("TEAM_KEY")], queryClient);

    expect(result.current.isChecking).toBe(true);

    act(() => listTeamSecrets([secret("TEAM_KEY")]));

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.rule).toEqual({
      kind: "team-required",
      teamOnly: ["TEAM_KEY"],
    });
  });

  it("checks only your secrets when the run falls back to you", async () => {
    const { result } = check({ status: "not-member", team: TEAM }, [
      usingSecrets("TEAM_KEY"),
    ]);

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.team).toBeUndefined();
    expect(result.current.missing).toEqual({ you: ["TEAM_KEY"], team: [] });
    expect(fetchSecrets).not.toHaveBeenCalledWith(TEAM.id);
  });

  it("checks nothing for a run that uses no secrets", () => {
    const { result } = check(ACTIVE, [{ greeting: "hello" }]);

    expect(result.current).toMatchObject({
      rule: { kind: "open", defaultAs: "you" },
      isChecking: false,
    });
    expect(fetchSecrets).not.toHaveBeenCalled();
  });

  it("waits for the team before checking", () => {
    const { result } = check({ status: "resolving" }, [usingSecrets("MY_KEY")]);

    expect(result.current.isChecking).toBe(true);
    expect(fetchSecrets).not.toHaveBeenCalled();
  });

  it("checks nothing for projects on different teams", () => {
    const { result } = check(
      {
        status: "conflict",
        teams: [TEAM, { id: "data@example.com", label: "Data" }],
      },
      [usingSecrets("MY_KEY")],
    );

    expect(result.current.isChecking).toBe(false);
    expect(fetchSecrets).not.toHaveBeenCalled();
  });

  it("names nothing missing when the secrets can't be listed", async () => {
    fetchSecrets.mockRejectedValue(new Error("backend down"));

    const { result } = check(ACTIVE, [usingSecrets("MY_KEY")]);

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.missing).toEqual({ you: [], team: [] });
  });
});

describe("useRunAsChoice", () => {
  const openIdentity = runIdentity({ team: TEAM, referenced: [] });

  it("starts from the rule's default and follows a choice", () => {
    const { result } = renderHook(() => useRunAsChoice(openIdentity));

    expect(result.current.runAs).toBe("you");
    act(() => result.current.choose("team"));
    expect(result.current.runAs).toBe("team");
    act(() => result.current.choose(undefined));
    expect(result.current.runAs).toBe("you");
  });

  it("forgets a choice made for another team", () => {
    const { result, rerender } = renderHook(
      ({ identity }) => useRunAsChoice(identity),
      { initialProps: { identity: openIdentity } },
    );

    act(() => result.current.choose("team"));
    rerender({
      identity: runIdentity({
        team: { id: "data@example.com", label: "Data" },
        referenced: [],
      }),
    });

    expect(result.current.runAs).toBe("you");
  });

  it("ignores a choice of you while only the team works", () => {
    const forced = runIdentity({
      team: TEAM,
      referenced: ["TEAM_KEY"],
      yourSecrets: [],
      teamSecrets: [secret("TEAM_KEY")],
    });
    const { result } = renderHook(() => useRunAsChoice(forced));

    act(() => result.current.choose("you"));
    expect(result.current.runAs).toBe("team");
  });
});
