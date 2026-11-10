import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SecretsList } from "./SecretsList";

const BACKEND = "http://backend.test";
const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ available: true, backendUrl: BACKEND }),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

vi.mock("../secretsStorage", () => ({
  removeSecret: vi.fn(),
  secretsListQuery: () => ({
    queryKey: ["secrets", "test"],
    queryFn: async () =>
      ["GITHUB_TOKEN", "OPENAI_KEY"].map((name) => ({
        id: name,
        name,
        createdAt: new Date("2026-11-01T10:00:00Z"),
        updatedAt: new Date("2026-11-01T10:00:00Z"),
      })),
  }),
}));

function settingsReply(settings: Record<string, unknown>) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ settings }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SecretsList />
    </QueryClientProvider>,
  );
}

const rowOf = (name: string) =>
  screen
    .getAllByTestId("secret-item")
    .find((row) => row.dataset.secretName === name) as HTMLElement;

describe("SecretsList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it("marks the secret chosen as the GitHub token", async () => {
    settingsReply({ github_token_secret_name: "GITHUB_TOKEN" });
    renderList();

    expect(await screen.findByText("GitHub token")).toBeVisible();
    expect(rowOf("GITHUB_TOKEN")).toHaveTextContent("GitHub token");
    expect(rowOf("OPENAI_KEY")).not.toHaveTextContent("GitHub token");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${BACKEND}/api/users/me/settings?setting_names=github_token_secret_name`,
    );
  });

  it("marks no secret when none is chosen", async () => {
    settingsReply({});
    renderList();

    expect(await screen.findByText("OPENAI_KEY")).toBeVisible();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("GitHub token")).toBeNull();
  });
});
