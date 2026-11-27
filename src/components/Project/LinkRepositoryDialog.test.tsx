import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { repositoryResourceInput } from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useCreateProjectResource } from "@/services/projects/useProjectResources";

import { LinkRepositoryDialog } from "./LinkRepositoryDialog";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/services/projects/useProjectResources", () => ({
  useCreateProjectResource: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

const API = "https://api.github.com";
const REPO_PATH = "/repos/TangleML/pipeline_components";
const REPO_URL = "https://github.com/TangleML/pipeline_components";

const REPOSITORY_BODY = {
  name: "pipeline_components",
  full_name: "TangleML/pipeline_components",
  default_branch: "master",
  private: false,
  owner: { login: "TangleML" },
};

function github(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  fetchMock.mockImplementation(async (input) =>
    String(input) === `${API}${REPO_PATH}`
      ? new Response(JSON.stringify(body), { status, headers })
      : new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
        }),
  );
}

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
const urlField = () => screen.getByLabelText("Repository or folder URL");

describe("LinkRepositoryDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    github(200, REPOSITORY_BODY);
    vi.mocked(useCreateProjectResource).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateProjectResource>);
  });

  afterEach(() => {
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
        },
        metadata: { type: "repository", url: REPO_URL },
      },
      expect.anything(),
    );
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

  it("does not link the same repository and folder twice", async () => {
    const user = await openDialog([
      linkedRow(
        repositoryResourceInput({
          owner: "TangleML",
          repo: "pipeline_components",
          ref: "master",
          path: "components/data",
        }),
      ),
    ]);

    await check(user, `${REPO_URL}/tree/master/components/data`);

    expect(
      await screen.findByText(
        "TangleML/pipeline_components/components/data is already linked to this project.",
      ),
    ).toBeVisible();
    expect(linkButton()).toBeDisabled();
  });

  it("links another folder of a repository already linked", async () => {
    const user = await openDialog([
      linkedRow(
        repositoryResourceInput({
          owner: "TangleML",
          repo: "pipeline_components",
          ref: null,
          path: null,
        }),
      ),
    ]);

    await check(user, `${REPO_URL}/tree/master/components/data`);

    await screen.findByText("components/data");
    expect(screen.queryByText(/already linked/)).toBeNull();
    expect(linkButton()).toBeEnabled();
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

    expect(track).toHaveBeenCalledWith("projects.link_repository_completed");
    expect(notify).toHaveBeenCalledWith("Repository linked", "success");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("cannot be submitted twice while saving", async () => {
    vi.mocked(useCreateProjectResource).mockReturnValue({
      mutate,
      isPending: true,
    } as unknown as ReturnType<typeof useCreateProjectResource>);
    const user = await openDialog();

    await check(user, REPO_URL);
    await screen.findByText("TangleML/pipeline_components");

    expect(linkButton()).toBeDisabled();
  });
});
