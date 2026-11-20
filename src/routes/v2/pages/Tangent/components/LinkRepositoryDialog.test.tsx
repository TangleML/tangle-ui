import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { resolveRepositoryLink } from "@/services/github/resolveRepositoryLink";
import { repositoryResourceInput } from "@/services/projects/resourceDescriptor";
import type { ProjectResourceSummary } from "@/services/projects/types";
import { useDeleteProjectResource } from "@/services/projects/useProjectResources";

import { LinkRepositoryDialog } from "./LinkRepositoryDialog";

const archive = vi.hoisted(() => ({
  archived: new Set<string>(),
  restore: vi.fn(),
  archive: vi.fn(),
}));
const remove = vi.fn();

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ available: false, backendUrl: "" }),
}));

vi.mock("@/services/github/resolveRepositoryLink", () => ({
  resolveRepositoryLink: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useArchivedProjectItems", () => ({
  useArchivedProjectItems: () => archive,
}));

vi.mock("@/services/projects/useProjectResources", () => ({
  useDeleteProjectResource: vi.fn(),
}));

const REPOSITORY = {
  owner: "TangleML",
  repo: "pipeline_components",
  ref: null,
  path: null,
  isPrivate: false,
};
const REPO_URL = "https://github.com/TangleML/pipeline_components";
const LINK_INPUT = repositoryResourceInput(REPOSITORY);

const LINKED_ROW: ProjectResourceSummary = {
  id: "resource-1",
  projectId: "project-1",
  entity: "document",
  name: LINK_INPUT.name ?? null,
  entityId: null,
  metadata: LINK_INPUT.metadata ?? null,
  createdBy: null,
  createdAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-01T10:00:00Z"),
};

function renderDialog(resources: ProjectResourceSummary[]) {
  const close = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <LinkRepositoryDialog
      close={close}
      cancel={vi.fn()}
      projectId="project-1"
      resources={resources}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
          <Dialog open>
            <DialogContent>{children}</DialogContent>
          </Dialog>
        </QueryClientProvider>
      ),
    },
  );
  return { close, user: userEvent.setup() };
}

async function checkRepository(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Repository or folder URL"), REPO_URL);
  await user.click(screen.getByRole("button", { name: "Check" }));
  await screen.findByText("TangleML/pipeline_components");
}

describe("Tangent LinkRepositoryDialog", () => {
  beforeEach(() => {
    vi.mocked(resolveRepositoryLink).mockResolvedValue({
      repository: REPOSITORY,
      tokensSupported: false,
    });
    vi.mocked(useDeleteProjectResource).mockReturnValue({
      mutate: remove,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteProjectResource>);
  });

  afterEach(() => {
    archive.archived.clear();
    vi.resetAllMocks();
  });

  it("closes with the input to link a repository the project does not hold", async () => {
    const { close, user } = renderDialog([]);

    await checkRepository(user);
    await user.click(screen.getByRole("button", { name: "Link" }));

    expect(close).toHaveBeenCalledWith(LINK_INPUT);
    expect(remove).not.toHaveBeenCalled();
  });

  it("closes with the permission for agents to write when it was turned on", async () => {
    const { close, user } = renderDialog([]);

    await checkRepository(user);
    await user.click(
      screen.getByRole("switch", {
        name: "Allow agents to write to this repository",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Link" }));

    expect(close).toHaveBeenCalledWith(
      repositoryResourceInput({ ...REPOSITORY, allowWrites: true }),
    );
  });

  it("offers to replace a link the project already holds", async () => {
    const { close, user } = renderDialog([LINKED_ROW]);

    await checkRepository(user);

    expect(screen.getByText("Already linked")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Replace link" }));

    expect(remove).toHaveBeenCalledWith("resource-1", expect.anything());
    expect(close).not.toHaveBeenCalled();

    const [, options] = remove.mock.calls[0];
    await act(async () => options.onSuccess());

    expect(close).toHaveBeenCalledWith(LINK_INPUT);
  });

  describe("when the link is archived", () => {
    beforeEach(() => archive.archived.add("repository://id/resource-1"));

    it("restores it and closes without linking anything", async () => {
      const { close, user } = renderDialog([LINKED_ROW]);

      await checkRepository(user);

      expect(screen.getByText("Archived")).toBeVisible();
      expect(
        screen.getByText(
          "TangleML/pipeline_components is linked to this project, but archived. Restore it to show it again.",
        ),
      ).toBeVisible();
      const restoreButton = screen.getByRole("button", { name: "Restore" });
      expect(restoreButton).toHaveAttribute(
        "data-tracking-id",
        "projects.link_repository_restore",
      );

      await user.click(restoreButton);

      expect(archive.restore).toHaveBeenCalledWith(
        "repository://id/resource-1",
      );
      expect(close).toHaveBeenCalledWith();
      expect(remove).not.toHaveBeenCalled();
    });

    it("restores on Enter once the URL has been checked", async () => {
      const { close, user } = renderDialog([LINKED_ROW]);

      await user.type(
        screen.getByLabelText("Repository or folder URL"),
        `${REPO_URL}{Enter}`,
      );
      await screen.findByText("TangleML/pipeline_components");
      await user.keyboard("{Enter}");

      expect(archive.restore).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledWith();
    });

    it("can replace it instead", async () => {
      const { close, user } = renderDialog([LINKED_ROW]);

      await checkRepository(user);
      await user.click(screen.getByRole("button", { name: "Replace link" }));

      expect(archive.restore).not.toHaveBeenCalled();
      expect(remove).toHaveBeenCalledWith("resource-1", expect.anything());

      const [, options] = remove.mock.calls[0];
      await act(async () => options.onSuccess());

      expect(close).toHaveBeenCalledWith(LINK_INPUT);
    });
  });
});
