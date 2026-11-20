import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { repositoryResourceInput } from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";
import {
  useCreateProjectResource,
  useDeleteProjectResource,
} from "@/services/projects/useProjectResources";

import { LinkRepositoryDialog } from "./LinkRepositoryDialog";

const mutate = vi.fn();
const remove = vi.fn();
const notify = vi.fn();
const track = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/services/projects/useProjectResources", () => ({
  useCreateProjectResource: vi.fn(),
  useDeleteProjectResource: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

const BACKEND = "http://backend.test";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ available: true, backendUrl: BACKEND }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const API = "https://api.github.com";
const REPO_PATH = "/repos/TangleML/pipeline_components";
const REPO_URL = "https://github.com/TangleML/pipeline_components";
const TOKEN_STATUS = `${BACKEND}/api/github/token_status`;
const GRANTS = `${BACKEND}/api/github/repository_grants`;

const REPOSITORY_BODY = {
  name: "pipeline_components",
  full_name: "TangleML/pipeline_components",
  default_branch: "master",
  private: false,
  owner: { login: "TangleML" },
};

interface Reply {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const replies = new Map<string, Reply>();

function reply(method: string, url: string, answer: Reply) {
  replies.set(`${method} ${url}`, answer);
}

function github(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  reply("GET", `${API}${REPO_PATH}`, { status, body, headers });
}

function tokenStatus(state: string, login: string | null = null) {
  reply("GET", TOKEN_STATUS, {
    status: 200,
    body: {
      secret_name: state === "not_configured" ? null : "GITHUB_TOKEN",
      state,
      login,
      token_kind: state === "valid" ? "fine_grained" : null,
    },
  });
}

function grant(isPrivate: boolean, defaultBranch = "main") {
  reply("POST", GRANTS, {
    status: 201,
    body: {
      id: 7,
      owner: "TangleML",
      repo: "pipeline_components",
      private: isPrivate,
      default_branch: defaultBranch,
      created_at: "2026-11-10T09:00:00",
    },
  });
}

function refExists(kind: string, name: string, exists: boolean) {
  const query = new URLSearchParams({ kind, name });
  reply("GET", `${GRANTS}/7/ref_exists?${query}`, {
    status: 200,
    body: { exists },
  });
}

function answer(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const found = replies.get(`${init?.method ?? "GET"} ${url}`);
  if (found) {
    return new Response(JSON.stringify(found.body), {
      status: found.status,
      headers: found.headers,
    });
  }
  const notFound = url.startsWith(BACKEND)
    ? { detail: "Not Found" }
    : { message: "Not Found" };
  return new Response(JSON.stringify(notFound), { status: 404 });
}

const requested = () =>
  fetchMock.mock.calls.map(
    ([input, init]) => `${init?.method ?? "GET"} ${String(input)}`,
  );

function linkedRow(
  input: ReturnType<typeof repositoryResourceInput>,
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: input.name ?? null,
    entityId: null,
    metadata: input.metadata ?? null,
    createdBy: null,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
  };
}

function Harness({ resources }: { resources: ProjectResourceSummary[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <LinkRepositoryDialog
        projectId="project-1"
        resources={resources}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

async function openDialog(resources: ProjectResourceSummary[] = []) {
  const user = userEvent.setup();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<Harness resources={resources} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

  await user.click(screen.getByRole("button", { name: "Open" }));
  await screen.findByRole("dialog");

  return user;
}

async function check(user: ReturnType<typeof userEvent.setup>, url: string) {
  await user.type(screen.getByLabelText("Repository or folder URL"), url);
  await user.click(screen.getByRole("button", { name: "Check" }));
}

const linkButton = () => screen.getByRole("button", { name: "Link" });
const replaceButton = () =>
  screen.getByRole("button", { name: "Replace link" });
const urlField = () => screen.getByLabelText("Repository or folder URL");

const REPLACE_HELP =
  "Replacing removes the current link and links the repository again as you, with your GitHub access.";

function mutations({
  creating = false,
  deleting = false,
}: { creating?: boolean; deleting?: boolean } = {}) {
  vi.mocked(useCreateProjectResource).mockReturnValue({
    mutate,
    isPending: creating,
  } as unknown as ReturnType<typeof useCreateProjectResource>);
  vi.mocked(useDeleteProjectResource).mockReturnValue({
    mutate: remove,
    isPending: deleting,
  } as unknown as ReturnType<typeof useDeleteProjectResource>);
}

describe("LinkRepositoryDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (input, init) => answer(input, init));
    github(200, REPOSITORY_BODY);
    mutations();
  });

  afterEach(() => {
    replies.clear();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it("cannot link anything before a URL has been checked", async () => {
    const user = await openDialog();

    await user.type(
      screen.getByLabelText("Repository or folder URL"),
      REPO_URL,
    );

    expect(linkButton()).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows what it found and links the whole repository", async () => {
    const user = await openDialog();

    await check(user, REPO_URL);

    expect(
      await screen.findByText("TangleML/pipeline_components"),
    ).toBeVisible();
    expect(screen.getByText("Default branch")).toBeVisible();
    expect(screen.getByText("Whole repository")).toBeVisible();

    await user.click(linkButton());

    expect(mutate).toHaveBeenCalledWith(
      {
        entity: "document",
        name: "TangleML/pipeline_components",
        payload: {
          owner: "TangleML",
          repo: "pipeline_components",
          ref: null,
          path: null,
          private: false,
        },
        metadata: { type: "repository", url: REPO_URL },
      },
      expect.anything(),
    );
    expect(screen.queryByText("No GitHub token")).toBeNull();
  });

  it("shows the branch and folder of a folder URL", async () => {
    const user = await openDialog();

    await check(user, `${REPO_URL}/tree/master/components/data`);

    expect(await screen.findByText("master")).toBeVisible();
    expect(screen.getByText("components/data")).toBeVisible();
    expect(linkButton()).toBeEnabled();
  });

  it("checks the URL when Enter is pressed, and links on the next Enter", async () => {
    const user = await openDialog();

    await user.type(
      screen.getByLabelText("Repository or folder URL"),
      `${REPO_URL}{Enter}`,
    );
    await screen.findByText("TangleML/pipeline_components");
    await user.keyboard("{Enter}");

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("refuses a repository it cannot see", async () => {
    github(404, { message: "Not Found" });
    const user = await openDialog();

    await check(user, "https://github.com/TangleML/secret-sauce");

    expect(
      await screen.findByText(
        "This repository is private or doesn't exist. Private repositories aren't supported yet.",
      ),
    ).toBeVisible();
    expect(linkButton()).toBeDisabled();
    expect(urlField()).toHaveAttribute("aria-invalid", "true");
    expect(urlField()).toHaveAccessibleDescription(
      /This repository is private or doesn't exist/,
    );
    expect(
      screen.queryByRole("link", { name: "Settings → GitHub" }),
    ).toBeNull();
    expect(requested()).not.toContain(`POST ${GRANTS}`);
  });

  it("says when GitHub has stopped answering for a while, without blaming the URL", async () => {
    github(
      403,
      { message: "API rate limit exceeded" },
      { "x-ratelimit-remaining": "0" },
    );
    const user = await openDialog();

    await check(user, REPO_URL);

    expect(await screen.findByText(/Try again later\./)).toBeVisible();
    expect(screen.getByText(/60 lookups an hour/)).toBeVisible();
    expect(linkButton()).toBeDisabled();
    expect(urlField()).not.toHaveAttribute("aria-invalid");
  });

  it("asks GitHub again when the same URL is checked after a failure", async () => {
    github(
      403,
      { message: "API rate limit exceeded" },
      { "x-ratelimit-remaining": "0" },
    );
    const user = await openDialog();
    await check(user, REPO_URL);
    await screen.findByText(/Try again later\./);

    github(200, REPOSITORY_BODY);
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(
      await screen.findByText("TangleML/pipeline_components"),
    ).toBeVisible();
    expect(linkButton()).toBeEnabled();
  });

  describe("when the repository and folder are already linked", () => {
    const linkedFolder = () =>
      linkedRow(
        repositoryResourceInput({
          owner: "TangleML",
          repo: "pipeline_components",
          ref: "master",
          path: "components/data",
          isPrivate: false,
        }),
      );
    const FOLDER_URL = `${REPO_URL}/tree/master/components/data`;

    it("offers to replace the link instead of linking it twice", async () => {
      const user = await openDialog([linkedFolder()]);

      await check(user, FOLDER_URL);

      expect(
        await screen.findByText(
          "TangleML/pipeline_components/components/data is already linked to this project.",
        ),
      ).toBeVisible();
      expect(screen.getByText(REPLACE_HELP)).toBeVisible();
      expect(screen.queryByRole("button", { name: "Link" })).toBeNull();
      expect(screen.queryByText("Archived")).toBeNull();
      expect(replaceButton()).toBeEnabled();
      expect(replaceButton()).toHaveAttribute(
        "data-tracking-id",
        "projects.link_repository_replace",
      );
    });

    it("removes the old link and links again as the current user", async () => {
      const user = await openDialog([linkedFolder()]);
      await check(user, FOLDER_URL);
      await screen.findByText(/already linked/);

      await user.click(replaceButton());

      expect(remove).toHaveBeenCalledWith("resource-1", expect.anything());
      expect(mutate).not.toHaveBeenCalled();

      const [, removal] = remove.mock.calls[0];
      await act(async () => removal.onSuccess());

      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "TangleML/pipeline_components/components/data",
        }),
        expect.anything(),
      );
      const [, creation] = mutate.mock.calls[0];
      await act(async () => creation.onSuccess());
      expect(track).toHaveBeenCalledWith("projects.link_repository_completed", {
        private: false,
        has_grant: false,
      });
      expect(notify).toHaveBeenCalledWith("Repository linked", "success");
    });

    it("replaces on Enter once the URL has been checked", async () => {
      const user = await openDialog([linkedFolder()]);

      await user.type(urlField(), `${FOLDER_URL}{Enter}`);
      await screen.findByText(/already linked/);
      await user.keyboard("{Enter}");

      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("cannot replace twice while the old link is being removed", async () => {
      mutations({ deleting: true });
      const user = await openDialog([linkedFolder()]);

      await check(user, FOLDER_URL);
      await screen.findByText(/already linked/);

      expect(replaceButton()).toBeDisabled();
    });
  });

  it("links another folder of a repository already linked", async () => {
    const user = await openDialog([
      linkedRow(
        repositoryResourceInput({
          owner: "TangleML",
          repo: "pipeline_components",
          ref: null,
          path: null,
          isPrivate: false,
        }),
      ),
    ]);

    await check(user, `${REPO_URL}/tree/master/components/data`);

    await screen.findByText("components/data");
    expect(screen.queryByText(/already linked/)).toBeNull();
    expect(linkButton()).toBeEnabled();
  });

  describe("letting agents write", () => {
    const writesSwitch = () =>
      screen.getByRole("switch", {
        name: "Allow agents to write to this repository",
      });
    const PUBLIC_WARNING =
      "Anything an agent pushes to a public repository is visible immediately.";

    it("starts off, and leaves the link read-only unless turned on", async () => {
      const user = await openDialog();

      await check(user, REPO_URL);
      await screen.findByText("TangleML/pipeline_components");

      expect(writesSwitch()).not.toBeChecked();
      expect(writesSwitch()).toHaveAccessibleDescription(
        /open draft pull requests, create issues and post comments/,
      );
      expect(writesSwitch()).toHaveAttribute(
        "data-tracking-id",
        "projects.link_repository_allow_writes",
      );

      await user.click(linkButton());

      const [input] = mutate.mock.calls[0];
      expect(input.payload).not.toHaveProperty("allowWrites");
    });

    it("records the permission in the link once turned on", async () => {
      const user = await openDialog();

      await check(user, REPO_URL);
      await screen.findByText("TangleML/pipeline_components");
      await user.click(writesSwitch());

      expect(writesSwitch()).toBeChecked();

      await user.click(linkButton());

      const [input] = mutate.mock.calls[0];
      expect(input.payload).toMatchObject({ allowWrites: true });
    });

    it("warns that writes to a public repository show at once", async () => {
      const user = await openDialog();

      await check(user, REPO_URL);
      await screen.findByText("TangleML/pipeline_components");

      expect(screen.getByText(PUBLIC_WARNING)).toBeVisible();
      expect(writesSwitch()).toHaveAccessibleDescription(
        new RegExp(PUBLIC_WARNING),
      );
    });

    it("does not warn about a private repository", async () => {
      tokenStatus("valid", "octocat");
      grant(true);
      const user = await openDialog();

      await check(user, REPO_URL);
      await screen.findByText("Private");

      expect(writesSwitch()).toBeVisible();
      expect(screen.queryByText(PUBLIC_WARNING)).toBeNull();
    });

    it("carries the permission into a replaced link", async () => {
      const user = await openDialog([
        linkedRow(
          repositoryResourceInput({
            owner: "TangleML",
            repo: "pipeline_components",
            ref: null,
            path: null,
            isPrivate: false,
          }),
        ),
      ]);

      await check(user, REPO_URL);
      await screen.findByText(/already linked/);
      await user.click(writesSwitch());
      await user.click(replaceButton());
      const [, removal] = remove.mock.calls[0];
      await act(async () => removal.onSuccess());

      const [input] = mutate.mock.calls[0];
      expect(input.payload).toMatchObject({ allowWrites: true });
    });
  });

  it("rejects a URL that is not a GitHub repository without asking GitHub", async () => {
    const user = await openDialog();

    await check(user, "https://gitlab.com/TangleML/pipeline_components");

    expect(
      await screen.findByText(/That isn't a GitHub repository URL/),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forgets what it found once the URL changes", async () => {
    const user = await openDialog();

    await check(user, REPO_URL);
    await screen.findByText("TangleML/pipeline_components");
    await user.type(screen.getByLabelText("Repository or folder URL"), "/tree");

    expect(screen.queryByText("TangleML/pipeline_components")).toBeNull();
    expect(linkButton()).toBeDisabled();
  });

  it("closes and says so once the link lands", async () => {
    const user = await openDialog();

    await check(user, REPO_URL);
    await screen.findByText("TangleML/pipeline_components");
    await user.click(linkButton());

    const [, options] = mutate.mock.calls[0];
    await act(async () => options.onSuccess());

    expect(track).toHaveBeenCalledWith("projects.link_repository_completed", {
      private: false,
      has_grant: false,
    });
    expect(notify).toHaveBeenCalledWith("Repository linked", "success");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("cannot be submitted twice while saving", async () => {
    mutations({ creating: true });
    const user = await openDialog();

    await check(user, REPO_URL);
    await screen.findByText("TangleML/pipeline_components");

    expect(linkButton()).toBeDisabled();
  });

  describe("on a backend that supports GitHub tokens", () => {
    const settingsLink = () =>
      screen.getByRole("link", { name: "Settings → GitHub" });
    const anonymousCalls = () =>
      requested().filter((call) => call.includes(API));

    async function linkAndReport(user: ReturnType<typeof userEvent.setup>) {
      await user.click(linkButton());
      const [input, options] = mutate.mock.calls[0];
      await act(async () => options.onSuccess());
      return input;
    }

    describe("without a usable token", () => {
      it("links a public repository without a token, and points to Settings", async () => {
        tokenStatus("not_configured");
        const user = await openDialog();

        await check(user, REPO_URL);

        expect(await screen.findByText("No GitHub token")).toBeVisible();
        expect(screen.getByText(/Add one in/)).toBeVisible();
        expect(settingsLink()).toHaveAttribute("href", "/settings/github");
        expect(settingsLink()).toHaveAttribute("target", "_blank");
        expect(screen.queryByText("Private")).toBeNull();

        const input = await linkAndReport(user);
        expect(input.payload).toEqual({
          owner: "TangleML",
          repo: "pipeline_components",
          ref: null,
          path: null,
          private: false,
        });
        expect(track).toHaveBeenCalledWith(
          "projects.link_repository_completed",
          { private: false, has_grant: false },
        );
        expect(requested()).not.toContain(`POST ${GRANTS}`);
      });

      it("points to Settings when the repository is hidden", async () => {
        github(404, { message: "Not Found" });
        tokenStatus("not_configured");
        const user = await openDialog();

        await check(user, REPO_URL);

        expect(
          await screen.findByText(
            "This repository is private or doesn't exist.",
          ),
        ).toBeVisible();
        expect(screen.getByText(/To link private repositories/)).toBeVisible();
        expect(settingsLink()).toBeVisible();
        expect(linkButton()).toBeDisabled();
      });

      it("offers a token when anonymous lookups are rate-limited", async () => {
        github(
          403,
          { message: "API rate limit exceeded" },
          { "x-ratelimit-remaining": "0" },
        );
        tokenStatus("not_configured");
        const user = await openDialog();

        await check(user, REPO_URL);

        expect(await screen.findByText(/60 lookups an hour/)).toBeVisible();
        expect(
          screen.getByText(/To look it up with your own GitHub token/),
        ).toBeVisible();
        expect(settingsLink()).toBeVisible();
      });

      it("says the chosen token can't be used, without blaming the URL", async () => {
        github(404, { message: "Not Found" });
        tokenStatus("invalid");
        const user = await openDialog();

        await check(user, REPO_URL);

        expect(
          await screen.findByText(
            /Your GitHub token can't be used right now\./,
          ),
        ).toBeVisible();
        expect(screen.getByText(/Check it in/)).toBeVisible();
        expect(settingsLink()).toBeVisible();
        expect(urlField()).not.toHaveAttribute("aria-invalid");
        expect(requested()).not.toContain(`POST ${GRANTS}`);
      });
    });

    describe("with a working token", () => {
      beforeEach(() => tokenStatus("valid", "octocat"));

      it("links a public repository through the token and keeps its grant", async () => {
        grant(false, "master");
        const user = await openDialog();

        await check(user, REPO_URL);

        expect(
          await screen.findByText("TangleML/pipeline_components"),
        ).toBeVisible();
        expect(screen.queryByText("Private")).toBeNull();
        expect(screen.queryByText("No GitHub token")).toBeNull();
        expect(anonymousCalls()).toEqual([]);

        const input = await linkAndReport(user);
        expect(input.payload).toEqual({
          owner: "TangleML",
          repo: "pipeline_components",
          ref: null,
          path: null,
          private: false,
          grantId: "7",
        });
        expect(track).toHaveBeenCalledWith(
          "projects.link_repository_completed",
          { private: false, has_grant: true },
        );
      });

      it("marks a private repository and warns who can read it", async () => {
        grant(true);
        const user = await openDialog();

        await check(user, REPO_URL);

        expect(await screen.findByText("Private")).toBeVisible();
        expect(
          screen.getByText("Anyone who can open this project can read it."),
        ).toBeVisible();
        expect(screen.queryByText("No GitHub token")).toBeNull();

        const input = await linkAndReport(user);
        expect(input.payload).toMatchObject({ private: true, grantId: "7" });
        expect(input.metadata).toEqual({ type: "repository", url: REPO_URL });
        expect(track).toHaveBeenCalledWith(
          "projects.link_repository_completed",
          { private: true, has_grant: true },
        );
      });

      it("sends the grant request without acting for a workspace", async () => {
        grant(true);
        const user = await openDialog();

        await check(user, REPO_URL);
        await screen.findByText("Private");

        const grantCall = fetchMock.mock.calls.find(
          ([input, init]) =>
            String(input) === GRANTS && init?.method === "POST",
        );
        expect(grantCall?.[1]?.body).toBe(
          JSON.stringify({ owner: "TangleML", repo: "pipeline_components" }),
        );
        expect(grantCall?.[1]?.headers).toEqual({
          "Content-Type": "application/json",
        });
      });

      it("resolves the branch of a folder URL through the backend", async () => {
        grant(true);
        refExists("branch", "release/v2/components", false);
        refExists("branch", "release/v2", true);
        const user = await openDialog();

        await check(user, `${REPO_URL}/tree/release/v2/components`);

        expect(await screen.findByText("release/v2")).toBeVisible();
        expect(screen.getByText("components")).toBeVisible();
        expect(requested()).toEqual(
          expect.arrayContaining([
            `GET ${GRANTS}/7/ref_exists?kind=branch&name=release%2Fv2%2Fcomponents`,
            `GET ${GRANTS}/7/ref_exists?kind=branch&name=release%2Fv2`,
          ]),
        );
        expect(anonymousCalls()).toEqual([]);
      });

      it("says when the token can't see the repository", async () => {
        reply("POST", GRANTS, {
          status: 404,
          body: { detail: "Not visible", code: "not_visible" },
        });
        const user = await openDialog();

        await check(user, REPO_URL);

        expect(
          await screen.findByText(
            "Your GitHub token can't see this repository. If it's private, give the token access to it on GitHub.",
          ),
        ).toBeVisible();
        expect(linkButton()).toBeDisabled();
        expect(anonymousCalls()).toEqual([]);
      });

      it("links without a token when the backend refuses the token", async () => {
        reply("POST", GRANTS, {
          status: 409,
          body: { detail: "GitHub rejected the token", code: "token_invalid" },
        });
        const user = await openDialog();

        await check(user, REPO_URL);

        expect(await screen.findByText("No GitHub token")).toBeVisible();
        expect(anonymousCalls()).toEqual([`GET ${API}${REPO_PATH}`]);

        const input = await linkAndReport(user);
        expect(input.payload).not.toHaveProperty("grantId");
      });

      it("offers to relink a repository linked before the token was chosen, with the grant", async () => {
        grant(false, "master");
        const user = await openDialog([
          linkedRow(
            repositoryResourceInput({
              owner: "TangleML",
              repo: "pipeline_components",
              ref: null,
              path: null,
              isPrivate: false,
            }),
          ),
        ]);

        await check(user, REPO_URL);

        expect(
          await screen.findByText(
            "TangleML/pipeline_components is already linked to this project.",
          ),
        ).toBeVisible();
        expect(screen.queryByText("No GitHub token")).toBeNull();
        expect(replaceButton()).toBeEnabled();

        await user.click(replaceButton());
        const [, removal] = remove.mock.calls[0];
        await act(async () => removal.onSuccess());

        const [input] = mutate.mock.calls[0];
        expect(input.payload).toMatchObject({ grantId: "7" });
      });
    });
  });
});
