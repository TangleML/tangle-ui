import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkPATStatus } from "@/components/shared/GitHubLibrary/utils/checkPATStatus";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { TokenStatusButton } from "./TokenStatusButton";

vi.mock("@/components/shared/GitHubLibrary/utils/checkPATStatus", () => ({
  checkPATStatus: vi.fn(),
}));

function githubLibrary(accessToken: string): StoredLibrary {
  return {
    id: `github-library-${accessToken || "public"}`,
    name: "owner/repo",
    type: "github",
    knownDigests: [],
    configuration: {
      created_at: "2024-01-01T00:00:00.000Z",
      last_updated_at: "2024-01-01T00:00:00.000Z",
      repo_name: "owner/repo",
      access_token: accessToken,
      auto_update: false,
    },
  };
}

function renderButton(library: StoredLibrary) {
  const user = userEvent.setup();
  const onUpdateClick = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <TokenStatusButton library={library} onUpdateClick={onUpdateClick} />
    </QueryClientProvider>,
  );
  return { user, onUpdateClick };
}

async function tooltipOf(
  user: ReturnType<typeof userEvent.setup>,
  button: HTMLElement,
) {
  const hoverTarget = button.parentElement;
  if (!hoverTarget) {
    throw new Error("A disabled TooltipButton is hovered through its wrapper");
  }
  await user.hover(hoverTarget);
  return screen.findByRole("tooltip");
}

describe("TokenStatusButton", () => {
  beforeEach(() => {
    vi.mocked(checkPATStatus).mockReset();
  });

  it("renders an enabled public-access button without checking a token when the token is empty", async () => {
    const library = githubLibrary("");
    const { user, onUpdateClick } = renderButton(library);

    const button = await screen.findByRole("button");

    expect(button).toBeEnabled();
    expect(await tooltipOf(user, button)).toHaveTextContent(
      "No token — public repository access. Click to add one.",
    );
    expect(checkPATStatus).not.toHaveBeenCalled();

    await user.click(button);

    expect(onUpdateClick).toHaveBeenCalledWith(library);
  });

  it("checks the token and renders a disabled valid state when the token is valid", async () => {
    vi.mocked(checkPATStatus).mockResolvedValue(true);
    const { user } = renderButton(githubLibrary("ghp_valid"));

    const button = await screen.findByRole("button");

    await waitFor(() =>
      expect(checkPATStatus).toHaveBeenCalledWith("owner/repo", "ghp_valid"),
    );
    expect(button).toBeDisabled();
    expect(await tooltipOf(user, button)).toHaveTextContent("Token is valid");
  });

  it("checks the token and renders an enabled invalid state when the token is invalid", async () => {
    vi.mocked(checkPATStatus).mockResolvedValue(false);
    const library = githubLibrary("ghp_invalid");
    const { user, onUpdateClick } = renderButton(library);

    const button = await screen.findByRole("button");

    await waitFor(() =>
      expect(checkPATStatus).toHaveBeenCalledWith("owner/repo", "ghp_invalid"),
    );
    expect(button).toBeEnabled();
    expect(button.querySelector("svg")).toHaveClass("text-red-500");
    expect(await tooltipOf(user, button)).toHaveTextContent(
      "Token is invalid. Click to update.",
    );

    await user.click(button);

    expect(onUpdateClick).toHaveBeenCalledWith(library);
  });
});
