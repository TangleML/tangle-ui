import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchGitHubFiles } from "@/components/shared/GitHubLibrary/utils/fetchGitHubFiles";

import { AddGitHubLibraryDialogContent } from "./AddGitHubLibraryDialogContent";

const notify = vi.fn();

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/components/shared/GitHubLibrary/utils/fetchGitHubFiles", () => ({
  fetchGitHubFiles: vi.fn(),
}));

vi.mock("@/components/shared/GitHubLibrary/utils/ensureGithubLibrary", () => ({
  ensureGithubLibrary: vi.fn(),
}));

vi.mock(
  "@/components/shared/ManageComponent/utils/hydrateAllComponents",
  () => ({
    hydrateAllComponents: vi.fn().mockResolvedValue([]),
  }),
);

function renderDialog() {
  const user = userEvent.setup();
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AddGitHubLibraryDialogContent onOkClick={vi.fn()} />
    </QueryClientProvider>,
  );
  return user;
}

const addButton = () => screen.getByRole("button", { name: /Add Library/ });

describe("AddGitHubLibraryDialogContent", () => {
  beforeEach(() => {
    vi.mocked(fetchGitHubFiles).mockReset();
    vi.mocked(fetchGitHubFiles).mockResolvedValue([]);
  });

  it("enables Add with a valid repository name and an empty token", async () => {
    const user = renderDialog();

    await user.type(screen.getByLabelText("Repository Name"), "owner/repo");

    expect(addButton()).toBeEnabled();
  });

  it("disables Add when the token has an invalid prefix", async () => {
    const user = renderDialog();

    await user.type(screen.getByLabelText("Repository Name"), "owner/repo");
    await user.type(screen.getByLabelText(/Personal Access Token/), "abc");

    expect(addButton()).toBeDisabled();
  });

  it("enables Add with a valid token and passes it to fetchGitHubFiles", async () => {
    const user = renderDialog();

    await user.type(screen.getByLabelText("Repository Name"), "owner/repo");
    await user.type(screen.getByLabelText(/Personal Access Token/), "ghp_abc");

    expect(addButton()).toBeEnabled();

    await user.click(addButton());

    await waitFor(() =>
      expect(fetchGitHubFiles).toHaveBeenCalledWith(
        "ghp_abc",
        "owner/repo",
        expect.any(Function),
      ),
    );
  });

  it("calls fetchGitHubFiles with an empty token when no token is entered", async () => {
    const user = renderDialog();

    await user.type(screen.getByLabelText("Repository Name"), "owner/repo");
    await user.click(addButton());

    await waitFor(() =>
      expect(fetchGitHubFiles).toHaveBeenCalledWith(
        "",
        "owner/repo",
        expect.any(Function),
      ),
    );
  });
});
