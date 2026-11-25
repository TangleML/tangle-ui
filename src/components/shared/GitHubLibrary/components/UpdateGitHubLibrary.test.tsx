import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkPATStatus } from "@/components/shared/GitHubLibrary/utils/checkPATStatus";
import { updateGitHubLibraryPAT } from "@/components/shared/GitHubLibrary/utils/updateGitHubLibraryPAT";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { UpdateGitHubLibrary } from "./UpdateGitHubLibrary";

const notify = vi.fn();

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/components/shared/GitHubLibrary/utils/checkPATStatus", () => ({
  checkPATStatus: vi.fn(),
}));

vi.mock(
  "@/components/shared/GitHubLibrary/utils/updateGitHubLibraryPAT",
  () => ({
    updateGitHubLibraryPAT: vi.fn(),
  }),
);

const library: StoredLibrary = {
  id: "github-library",
  name: "owner/repo",
  type: "github",
  configuration: { repo_name: "owner/repo" },
  knownDigests: [],
};

function renderUpdate() {
  const user = userEvent.setup();
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <UpdateGitHubLibrary library={library} onSuccess={vi.fn()} />
    </QueryClientProvider>,
  );
  return user;
}

const updateButton = () => screen.getByRole("button", { name: /Update token/ });

describe("UpdateGitHubLibrary", () => {
  beforeEach(() => {
    notify.mockReset();
    vi.mocked(checkPATStatus).mockReset();
    vi.mocked(updateGitHubLibraryPAT).mockReset();
    vi.mocked(updateGitHubLibraryPAT).mockResolvedValue(true);
  });

  it("enables Update token before anything is typed", () => {
    renderUpdate();

    expect(updateButton()).toBeEnabled();
  });

  it("stores an empty token when submitted with an empty field and the check passes", async () => {
    vi.mocked(checkPATStatus).mockResolvedValue(true);
    const user = renderUpdate();

    await user.click(updateButton());

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "GitHub library token updated",
        "success",
      ),
    );
    expect(checkPATStatus).toHaveBeenCalledWith("owner/repo", "");
    expect(updateGitHubLibraryPAT).toHaveBeenCalledWith(library, "");
  });

  it("shows an error and does not store the token when the check fails", async () => {
    vi.mocked(checkPATStatus).mockResolvedValue(false);
    const user = renderUpdate();

    await user.click(updateButton());

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining("Invalid Personal Access Token"),
        "error",
      ),
    );
    expect(updateGitHubLibraryPAT).not.toHaveBeenCalled();
  });

  it("passes a trimmed token to checkPATStatus", async () => {
    vi.mocked(checkPATStatus).mockResolvedValue(true);
    const user = renderUpdate();

    await user.type(
      screen.getByLabelText(/Personal Access Token/),
      "  ghp_abc  ",
    );
    await user.click(updateButton());

    await waitFor(() =>
      expect(checkPATStatus).toHaveBeenCalledWith("owner/repo", "ghp_abc"),
    );
  });

  it("disables Update token when the token has an invalid prefix", async () => {
    const user = renderUpdate();

    await user.type(screen.getByLabelText(/Personal Access Token/), "abc");

    expect(updateButton()).toBeDisabled();
  });
});
