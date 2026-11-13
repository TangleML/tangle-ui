import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import { readOpenTabs } from "@/routes/v2/pages/Tangent/workarea/openTabsStorage";
import type { WorkareaTarget } from "@/routes/v2/pages/Tangent/workarea/types";
import { idIdentity } from "@/services/projects/resourceTarget";

import { useRememberOpenTabs } from "./useRememberOpenTabs";

const getUserDetails = vi.hoisted(() => vi.fn());

vi.mock("@/utils/user", () => ({ getUserDetails }));

const TANGENT = "https://tangent.example";
const STORAGE_KEY = "tangent-open-tabs-by-user";
const run: WorkareaTarget = { type: "run", identity: idIdentity("r-1") };
const pipeline: WorkareaTarget = {
  type: "pipeline",
  identity: idIdentity("p-1"),
};

function signedInAs(userId: string) {
  getUserDetails.mockResolvedValue({ id: userId, permissions: [] });
}

function visit(tangentBaseUrl: string | null = TANGENT) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = new TangentProjectStore("project-1");
  const hook = renderHook(() => useRememberOpenTabs(store, tangentBaseUrl), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  const whenUserIsKnown = async () => {
    await waitFor(() => expect(client.getQueryData(["user"])).toBeDefined());
    await act(async () => {});
  };
  return { store, whenUserIsKnown, ...hook };
}

function titlesSavedFor(userId: string) {
  return readOpenTabs({ userId, projectId: "project-1" }, TANGENT).tabs.map(
    ({ title }) => title,
  );
}

describe("useRememberOpenTabs", () => {
  beforeEach(() => {
    localStorage.clear();
    getUserDetails.mockReset();
  });

  it("saves a person's tabs and brings them back on their next visit", async () => {
    signedInAs("user-1");
    const first = visit();
    await first.whenUserIsKnown();
    act(() => {
      first.store.openResolvedView({ title: "Nightly", target: run });
    });
    first.unmount();

    const next = visit();

    await waitFor(() =>
      expect(next.store.workareaTabs.map(({ title }) => title)).toEqual([
        "Nightly",
      ]),
    );
  });

  it("doesn't hand one person's tabs to the next person in this browser", async () => {
    signedInAs("user-1");
    const first = visit();
    await first.whenUserIsKnown();
    act(() => {
      first.store.openResolvedView({ title: "Nightly", target: run });
    });
    first.unmount();

    signedInAs("user-2");
    const next = visit();
    await next.whenUserIsKnown();

    expect(next.store.workareaTabs).toEqual([]);
    expect(titlesSavedFor("user-1")).toEqual(["Nightly"]);
  });

  it("neither restores nor saves until it's known who is here", async () => {
    signedInAs("user-1");
    const first = visit();
    await first.whenUserIsKnown();
    act(() => {
      first.store.openResolvedView({ title: "Nightly", target: run });
    });
    first.unmount();
    const savedBefore = localStorage.getItem(STORAGE_KEY);

    getUserDetails.mockReturnValue(new Promise(() => undefined));
    const next = visit();
    await act(async () => {});
    act(() => {
      next.store.openResolvedView({ title: "Churn model", target: pipeline });
    });

    expect(next.store.workareaTabs.map(({ title }) => title)).toEqual([
      "Churn model",
    ]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(savedBefore);
  });

  it("keeps a tab opened before the person was known, behind the restored ones", async () => {
    signedInAs("user-1");
    const first = visit();
    await first.whenUserIsKnown();
    act(() => {
      first.store.openResolvedView({ title: "Nightly", target: run });
    });
    first.unmount();

    let signIn: (user: { id: string; permissions: [] }) => void = () => {};
    getUserDetails.mockReturnValue(
      new Promise((resolve) => {
        signIn = resolve;
      }),
    );
    const next = visit();
    await act(async () => {});
    act(() => {
      next.store.openResolvedView({ title: "Churn model", target: pipeline });
    });
    await act(async () => signIn({ id: "user-1", permissions: [] }));

    await waitFor(() =>
      expect(next.store.workareaTabs.map(({ title }) => title)).toEqual([
        "Nightly",
        "Churn model",
      ]),
    );
    expect(titlesSavedFor("user-1")).toEqual(["Nightly", "Churn model"]);
  });

  it("saves a tab opened before the person was known when they had none saved", async () => {
    signedInAs("user-1");
    const { store, whenUserIsKnown } = visit();
    act(() => {
      store.openResolvedView({ title: "Churn model", target: pipeline });
    });
    await whenUserIsKnown();

    expect(titlesSavedFor("user-1")).toEqual(["Churn model"]);
  });

  it("tells the store which Tangent is this project's", () => {
    signedInAs("user-1");
    const { store } = visit();

    expect(store.tangentBaseUrl).toBe(TANGENT);
  });
});
