import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GitHubSettings } from "./GitHubSettings";

const BACKEND = "http://backend.test";
const TOKEN_STATUS = `${BACKEND}/api/github/token_status`;
const GRANTS = `${BACKEND}/api/github/repository_grants`;
const SETTINGS = `${BACKEND}/api/users/me/settings`;

const fetchMock = vi.fn<typeof fetch>();
const track = vi.fn();
const notify = vi.fn();
const backend = { available: true, backendUrl: BACKEND };

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/shared/SecretsManagement/secretsStorage", () => ({
  secretsListQuery: () => ({
    queryKey: ["secrets", "test"],
    queryFn: async () => [
      {
        id: "s-1",
        name: "GITHUB_TOKEN",
        createdAt: new Date("2026-11-01T10:00:00Z"),
        updatedAt: new Date("2026-11-01T10:00:00Z"),
      },
      {
        id: "s-2",
        name: "OPENAI_KEY",
        createdAt: new Date("2026-11-02T10:00:00Z"),
        updatedAt: new Date("2026-11-02T10:00:00Z"),
      },
    ],
  }),
}));

interface Reply {
  status: number;
  body?: unknown;
}

const replies = new Map<string, Reply>();

function reply(method: string, url: string, answer: Reply) {
  replies.set(`${method} ${url}`, answer);
}

function tokenStatus(body: Record<string, unknown>) {
  reply("GET", TOKEN_STATUS, {
    status: 200,
    body: { secret_name: null, login: null, token_kind: null, ...body },
  });
}

function grants(list: Record<string, unknown>[]) {
  reply("GET", GRANTS, { status: 200, body: { grants: list } });
}

const PRIVATE_GRANT = {
  id: 7,
  owner: "TangleML",
  repo: "secret-sauce",
  private: true,
  default_branch: "main",
  created_at: "2026-11-09T09:00:00",
};

const PUBLIC_GRANT = {
  ...PRIVATE_GRANT,
  id: 8,
  repo: "pipeline_components",
  private: false,
};

function answer(input: RequestInfo | URL, init?: RequestInit) {
  const found = replies.get(`${init?.method ?? "GET"} ${String(input)}`);
  if (!found) {
    return new Response(JSON.stringify({ detail: "Not Found" }), {
      status: 404,
    });
  }
  return found.body === undefined
    ? new Response(null, { status: found.status })
    : new Response(JSON.stringify(found.body), {
        status: found.status,
        headers: { "content-type": "application/json" },
      });
}

const requests = (method: string, url: string) =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input) === url && (init?.method ?? "GET") === method,
  );

function renderSettings() {
  const user = userEvent.setup();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <GitHubSettings />
    </QueryClientProvider>,
  );
  return user;
}

describe("GitHubSettings", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    backend.available = true;
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (input, init) => answer(input, init));
    grants([]);
  });

  afterEach(() => {
    replies.clear();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it("asks for a backend when none is connected", () => {
    backend.available = false;
    renderSettings();

    expect(screen.getByText("Backend not connected")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says when the backend doesn't support GitHub tokens", async () => {
    renderSettings();

    expect(
      await screen.findByText("This backend doesn't support GitHub tokens"),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Choose/ })).toBeNull();
    expect(requests("GET", GRANTS)).toHaveLength(0);
  });

  it("offers to try again when the token status can't be read", async () => {
    reply("GET", TOKEN_STATUS, {
      status: 500,
      body: { detail: "Database unavailable" },
    });
    const user = renderSettings();

    expect(await screen.findByText("Database unavailable")).toBeVisible();

    tokenStatus({ state: "not_configured" });
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No secret chosen")).toBeVisible();
  });

  describe("the token", () => {
    it("offers to add a secret when none is chosen", async () => {
      tokenStatus({ state: "not_configured" });
      renderSettings();

      expect(await screen.findByText("No secret chosen")).toBeVisible();
      expect(screen.getByRole("button", { name: "Add" })).toBeVisible();
      expect(screen.queryByRole("button", { name: "Unlink" })).toBeNull();
    });

    it("names the account a working token connects as", async () => {
      tokenStatus({
        secret_name: "GITHUB_TOKEN",
        state: "valid",
        login: "octocat",
        token_kind: "fine_grained",
      });
      renderSettings();

      expect(await screen.findByText("Connected as @octocat")).toBeVisible();
      expect(screen.getByText("GITHUB_TOKEN")).toBeVisible();
      expect(screen.queryByText("This is a classic token")).toBeNull();
      expect(
        screen.queryByRole("link", {
          name: /Create a fine-grained token on GitHub/,
        }),
      ).toBeNull();
      expect(screen.getByRole("button", { name: "Change" })).toBeVisible();
    });

    it("warns that a classic token reaches everything the account can", async () => {
      tokenStatus({
        secret_name: "GITHUB_TOKEN",
        state: "valid",
        login: "octocat",
        token_kind: "classic",
      });
      renderSettings();

      expect(await screen.findByText("This is a classic token")).toBeVisible();
      expect(
        screen.getByText(
          /can read and write everything your GitHub account can/,
        ),
      ).toBeVisible();
    });

    it("says when the secret has gone, and shows the steps again", async () => {
      tokenStatus({ secret_name: "GITHUB_TOKEN", state: "secret_missing" });
      renderSettings();

      expect(
        await screen.findByText('The secret "GITHUB_TOKEN" no longer exists.'),
      ).toBeVisible();
      expect(screen.getByText("Needs attention")).toBeVisible();
      expect(
        screen.getByRole("link", {
          name: /Create a fine-grained token on GitHub/,
        }),
      ).toBeVisible();
    });

    it("says when GitHub rejects the token", async () => {
      tokenStatus({ secret_name: "GITHUB_TOKEN", state: "invalid" });
      renderSettings();

      expect(
        await screen.findByText("GitHub doesn't accept this token."),
      ).toBeVisible();
    });

    it("lists the steps to set up a token", async () => {
      tokenStatus({ state: "not_configured" });
      renderSettings();

      const create = await screen.findByRole("link", {
        name: /Create a fine-grained token on GitHub/,
      });
      expect(create).toHaveAttribute(
        "href",
        "https://github.com/settings/personal-access-tokens/new",
      );
      expect(create).toHaveAttribute("target", "_blank");
      expect(screen.getByText(/Contents: read-only access/)).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Settings → Secrets" }),
      ).toHaveAttribute("href", "/settings/secrets");
      expect(screen.getByText("Add that secret below.")).toBeVisible();
    });
  });

  describe("choosing a secret", () => {
    it("saves the secret picked, once confirmed", async () => {
      tokenStatus({ state: "not_configured" });
      reply("PATCH", SETTINGS, { status: 204 });
      const user = renderSettings();

      await user.click(await screen.findByRole("button", { name: "Add" }));
      const dialog = await screen.findByRole("dialog");
      const confirm = within(dialog).getByRole("button", { name: "Confirm" });
      expect(confirm).toBeDisabled();

      await user.click(
        await within(dialog).findByRole("button", { name: /GITHUB_TOKEN/ }),
      );
      expect(
        within(dialog).getByRole("button", { name: /GITHUB_TOKEN/ }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(within(dialog).queryByRole("radio")).toBeNull();

      tokenStatus({
        secret_name: "GITHUB_TOKEN",
        state: "valid",
        login: "octocat",
      });
      await user.click(confirm);

      await waitFor(() => expect(requests("PATCH", SETTINGS)).toHaveLength(1));
      expect(requests("PATCH", SETTINGS)[0][1]?.body).toBe(
        JSON.stringify({
          settings: { github_token_secret_name: "GITHUB_TOKEN" },
        }),
      );
      expect(await screen.findByText("Connected as @octocat")).toBeVisible();
      expect(track).toHaveBeenCalledWith(
        "settings.github.choose_token_secret_completed",
        { replaced: false },
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("starts from the secret in use, and won't confirm it again", async () => {
      tokenStatus({
        secret_name: "GITHUB_TOKEN",
        state: "valid",
        login: "octocat",
      });
      const user = renderSettings();

      await user.click(await screen.findByRole("button", { name: "Change" }));
      const dialog = await screen.findByRole("dialog");

      expect(
        await within(dialog).findByRole("button", { name: /GITHUB_TOKEN/ }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        within(dialog).getByRole("button", { name: "Confirm" }),
      ).toBeDisabled();

      await user.click(
        within(dialog).getByRole("button", { name: /OPENAI_KEY/ }),
      );
      expect(
        within(dialog).getByRole("button", { name: "Confirm" }),
      ).toBeEnabled();
    });

    it("narrows the secrets to the ones matching the search", async () => {
      tokenStatus({ state: "not_configured" });
      const user = renderSettings();

      await user.click(await screen.findByRole("button", { name: "Add" }));
      const dialog = await screen.findByRole("dialog");
      await within(dialog).findByRole("button", { name: /OPENAI_KEY/ });

      await user.type(within(dialog).getByLabelText("Search secrets"), "git");

      expect(
        within(dialog).queryByRole("button", { name: /OPENAI_KEY/ }),
      ).toBeNull();
      expect(
        within(dialog).getByRole("button", { name: /GITHUB_TOKEN/ }),
      ).toBeVisible();
    });
  });

  it("unlinks the token once confirmed", async () => {
    tokenStatus({
      secret_name: "GITHUB_TOKEN",
      state: "valid",
      login: "octocat",
    });
    reply("DELETE", `${SETTINGS}?setting_names=github_token_secret_name`, {
      status: 204,
    });
    const user = renderSettings();

    await user.click(await screen.findByRole("button", { name: "Unlink" }));
    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation).toHaveTextContent(
      "Agents will stop using it for the repositories you've linked.",
    );

    tokenStatus({ state: "not_configured" });
    await user.click(
      within(confirmation).getByRole("button", { name: "Unlink" }),
    );

    expect(await screen.findByText("No secret chosen")).toBeVisible();
    expect(
      requests("DELETE", `${SETTINGS}?setting_names=github_token_secret_name`),
    ).toHaveLength(1);
    expect(track).toHaveBeenCalledWith(
      "settings.github.clear_token_secret_completed",
    );
  });

  describe("linked repositories", () => {
    beforeEach(() => {
      tokenStatus({
        secret_name: "GITHUB_TOKEN",
        state: "valid",
        login: "octocat",
      });
    });

    const row = (name: string) =>
      screen.getByText(name).closest("li") as HTMLElement;

    async function askToRevoke(
      user: ReturnType<typeof userEvent.setup>,
      name: string,
    ) {
      await user.click(
        await screen.findByRole("button", { name: `Revoke access to ${name}` }),
      );
      return screen.findByRole("alertdialog");
    }

    it("lists every repository linked with the token, marking the private ones", async () => {
      grants([PRIVATE_GRANT, PUBLIC_GRANT]);
      renderSettings();

      expect(
        await screen.findByRole("heading", { name: "Linked repositories" }),
      ).toBeVisible();
      expect(await screen.findByText("TangleML/secret-sauce")).toBeVisible();
      expect(screen.getByText("TangleML/pipeline_components")).toBeVisible();
      expect(
        within(row("TangleML/secret-sauce")).getByText("Private"),
      ).toBeVisible();
      expect(
        within(row("TangleML/pipeline_components")).queryByText("Private"),
      ).toBeNull();
    });

    it("says when there are none", async () => {
      grants([]);
      renderSettings();

      expect(await screen.findByText("No linked repositories")).toBeVisible();
    });

    it("says agents can no longer read a private repository once revoked", async () => {
      grants([PRIVATE_GRANT]);
      reply("DELETE", `${GRANTS}/7`, { status: 204 });
      const user = renderSettings();

      const confirmation = await askToRevoke(user, "TangleML/secret-sauce");
      expect(confirmation).toHaveTextContent(
        "Agents will no longer be able to read it.",
      );

      grants([]);
      await user.click(
        within(confirmation).getByRole("button", { name: "Revoke" }),
      );

      expect(await screen.findByText("No linked repositories")).toBeVisible();
      expect(requests("DELETE", `${GRANTS}/7`)).toHaveLength(1);
      expect(track).toHaveBeenCalledWith(
        "settings.github.revoke_repository_grant_completed",
        { private: true },
      );
    });

    it("says agents read a public repository without the token once revoked", async () => {
      grants([PUBLIC_GRANT]);
      reply("DELETE", `${GRANTS}/8`, { status: 204 });
      const user = renderSettings();

      const confirmation = await askToRevoke(
        user,
        "TangleML/pipeline_components",
      );
      expect(confirmation).toHaveTextContent(
        "Agents will read it without your token.",
      );

      await user.click(
        within(confirmation).getByRole("button", { name: "Revoke" }),
      );

      await waitFor(() =>
        expect(requests("DELETE", `${GRANTS}/8`)).toHaveLength(1),
      );
      expect(track).toHaveBeenCalledWith(
        "settings.github.revoke_repository_grant_completed",
        { private: false },
      );
    });

    it("keeps the repository when the revoke is cancelled", async () => {
      grants([PRIVATE_GRANT]);
      const user = renderSettings();

      const confirmation = await askToRevoke(user, "TangleML/secret-sauce");
      await user.click(
        within(confirmation).getByRole("button", { name: "Cancel" }),
      );

      expect(requests("DELETE", `${GRANTS}/7`)).toHaveLength(0);
      expect(screen.getByText("TangleML/secret-sauce")).toBeVisible();
    });
  });
});
