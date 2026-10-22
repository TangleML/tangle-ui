import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { removeSecret } from "../secretsStorage";
import { SecretsQueryKeys } from "../types";
import { RemoveSecretButton } from "./RemoveSecretButton";

vi.mock("../secretsStorage", () => ({ removeSecret: vi.fn() }));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

const TEAM_ID = "ml-team@example.com";

function renderButton(teamId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const onSuccess = vi.fn();
  render(
    <RemoveSecretButton
      secret={{ id: "API_KEY", name: "API_KEY" }}
      teamId={teamId}
      onSuccess={onSuccess}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    },
  );
  return { user: userEvent.setup(), onSuccess, invalidateQueries };
}

describe("RemoveSecretButton", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("asks before deleting", async () => {
    const { user } = renderButton();

    await user.click(screen.getByRole("button", { name: "Delete API_KEY" }));

    expect(
      screen.getByRole("alertdialog", { name: 'Delete "API_KEY"?' }),
    ).toHaveAccessibleDescription(
      "Runs that use it will fail when they start. This can't be undone.",
    );
    expect(removeSecret).not.toHaveBeenCalled();
  });

  it("deletes once confirmed", async () => {
    vi.mocked(removeSecret).mockResolvedValue(true);
    const { user, onSuccess } = renderButton();

    await user.click(screen.getByRole("button", { name: "Delete API_KEY" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(removeSecret).toHaveBeenCalledWith("API_KEY", undefined);
  });

  it("deletes a team's secret as the team", async () => {
    vi.mocked(removeSecret).mockResolvedValue(true);
    const { user, onSuccess, invalidateQueries } = renderButton(TEAM_ID);

    await user.click(screen.getByRole("button", { name: "Delete API_KEY" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(removeSecret).toHaveBeenCalledWith("API_KEY", TEAM_ID);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: SecretsQueryKeys.All(TEAM_ID),
    });
  });

  it("keeps the secret when cancelled", async () => {
    const { user } = renderButton();

    await user.click(screen.getByRole("button", { name: "Delete API_KEY" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(removeSecret).not.toHaveBeenCalled();
  });
});
