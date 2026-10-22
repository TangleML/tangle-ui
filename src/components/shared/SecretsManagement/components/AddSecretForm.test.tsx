import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TeamImpersonationError } from "@/services/teams/errors";

import { addSecret, updateSecret } from "../secretsStorage";
import { type Secret, SecretsQueryKeys } from "../types";
import { AddSecretForm, lastWholeSecondOfDayUTC } from "./AddSecretForm";

vi.mock("../secretsStorage", () => ({
  addSecret: vi.fn(),
  updateSecret: vi.fn(),
}));

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

const REFUSAL =
  "Impersonation error: alice@example.com is not a member of ml-team@example.com";

const TEAM_ID = "ml-team@example.com";

const existing: Secret = {
  id: "API_KEY",
  name: "API_KEY",
  description: "Model access",
  createdAt: new Date("2026-10-01T09:00:00Z"),
  updatedAt: new Date("2026-10-02T09:00:00Z"),
};

function renderForm({
  existingSecret,
  teamId,
}: { existingSecret?: Secret; teamId?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const onSuccess = vi.fn();
  render(
    <AddSecretForm
      existingSecret={existingSecret}
      teamId={teamId}
      onSuccess={onSuccess}
      onCancel={vi.fn()}
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

const field = (label: string) => screen.getByLabelText(label);

describe("AddSecretForm", () => {
  beforeEach(() => {
    vi.mocked(addSecret).mockResolvedValue(true);
    vi.mocked(updateSecret).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("adding", () => {
    it("adds a secret with a trimmed name and its description", async () => {
      const { user, onSuccess } = renderForm();

      await user.type(field("Secret Name"), "  API_KEY  ");
      await user.type(field("Secret Value"), "s3cret");
      await user.type(field("Description (optional)"), "  Model access ");
      await user.click(screen.getByRole("button", { name: "Add Secret" }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(addSecret).toHaveBeenCalledWith(
        {
          name: "API_KEY",
          value: "s3cret",
          description: "Model access",
          expiresAt: undefined,
        },
        undefined,
      );
    });

    it("adds a secret to the team it is given", async () => {
      const { user, onSuccess, invalidateQueries } = renderForm({
        teamId: TEAM_ID,
      });

      await user.type(field("Secret Name"), "API_KEY");
      await user.type(field("Secret Value"), "s3cret");
      await user.click(screen.getByRole("button", { name: "Add Secret" }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(addSecret).toHaveBeenCalledWith(expect.anything(), TEAM_ID);
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: SecretsQueryKeys.All(TEAM_ID),
      });
    });

    it("shows the backend's reason when adding as the team is refused", async () => {
      vi.mocked(addSecret).mockRejectedValue(
        new TeamImpersonationError(REFUSAL, 403),
      );
      const { user, onSuccess } = renderForm({ teamId: TEAM_ID });

      await user.type(field("Secret Name"), "API_KEY");
      await user.type(field("Secret Value"), "s3cret");
      await user.click(screen.getByRole("button", { name: "Add Secret" }));

      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith(REFUSAL, "error"),
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("leaves out a description that was never written", async () => {
      const { user } = renderForm();

      await user.type(field("Secret Name"), "API_KEY");
      await user.type(field("Secret Value"), "s3cret");
      await user.click(screen.getByRole("button", { name: "Add Secret" }));

      await waitFor(() =>
        expect(addSecret).toHaveBeenCalledWith(
          expect.objectContaining({ description: undefined }),
          undefined,
        ),
      );
    });

    it("refuses a name with a slash in it", async () => {
      const { user } = renderForm();

      await user.type(field("Secret Name"), "team/API_KEY");
      await user.type(field("Secret Value"), "s3cret");

      expect(screen.getByText("Secret name cannot contain /")).toBeVisible();
      expect(field("Secret Name")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("button", { name: "Add Secret" })).toBeDisabled();
    });

    it.each([".", "..", " .. "])(
      "refuses %j as a name, which the secret's URL can't hold",
      async (name) => {
        const { user } = renderForm();

        await user.type(field("Secret Name"), name);
        await user.type(field("Secret Value"), "s3cret");

        expect(
          screen.getByText('Secret name cannot be "." or ".."'),
        ).toBeVisible();
        expect(
          screen.getByRole("button", { name: "Add Secret" }),
        ).toBeDisabled();
      },
    );

    it("stops the name and description at the 255 characters the backend stores", async () => {
      const { user } = renderForm();

      await user.click(field("Secret Name"));
      await user.paste("N".repeat(300));
      await user.click(field("Description (optional)"));
      await user.paste("D".repeat(300));

      expect(field("Secret Name")).toHaveValue("N".repeat(255));
      expect(field("Secret Name")).toHaveAccessibleDescription(
        "Up to 255 characters.",
      );
      expect(field("Description (optional)")).toHaveValue("D".repeat(255));
      expect(field("Description (optional)")).toHaveAccessibleDescription(
        "Up to 255 characters.",
      );
    });

    it("keeps the browser from filling the value with a saved password", () => {
      renderForm();

      expect(field("Secret Value")).toHaveAttribute("type", "password");
      expect(field("Secret Value")).toHaveAttribute(
        "autocomplete",
        "new-password",
      );
    });

    it("sends the expiry as the last whole second of the chosen day in UTC", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 9, 31, 23, 59));
      const { user } = renderForm();

      await user.type(field("Secret Name"), "API_KEY");
      await user.type(field("Secret Value"), "s3cret");
      await user.click(field("Expires (optional)"));
      await user.click(screen.getByRole("button", { name: /next month/i }));
      await user.click(screen.getByRole("button", { name: /15th/ }));
      await user.click(screen.getByRole("button", { name: "Add Secret" }));

      await waitFor(() =>
        expect(addSecret).toHaveBeenCalledWith(
          expect.objectContaining({
            expiresAt: new Date("2026-11-15T23:59:59.000Z"),
          }),
          undefined,
        ),
      );
    });

    it("adds no hint to a new secret's expiry", () => {
      renderForm();

      expect(field("Expires (optional)")).not.toHaveAccessibleDescription();
    });
  });

  describe("replacing", () => {
    it("starts from the secret's description", () => {
      renderForm({ existingSecret: existing });

      expect(field("Secret Name")).toBeDisabled();
      expect(field("Description (optional)")).toHaveValue("Model access");
      expect(field("Description (optional)")).toHaveAccessibleDescription(
        "It can be changed but not removed.",
      );
    });

    it("sends only the new value when nothing else changed", async () => {
      const { user, onSuccess } = renderForm({ existingSecret: existing });

      await user.type(field("New Secret Value"), "n3w");
      await user.click(screen.getByRole("button", { name: "Update Secret" }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(updateSecret).toHaveBeenCalledWith(
        "API_KEY",
        {
          id: "API_KEY",
          value: "n3w",
          description: undefined,
          expiresAt: undefined,
        },
        undefined,
      );
    });

    it("replaces a team's secret as the team", async () => {
      const { user, onSuccess, invalidateQueries } = renderForm({
        existingSecret: existing,
        teamId: TEAM_ID,
      });

      await user.type(field("New Secret Value"), "n3w");
      await user.click(screen.getByRole("button", { name: "Update Secret" }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(updateSecret).toHaveBeenCalledWith(
        "API_KEY",
        expect.anything(),
        TEAM_ID,
      );
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: SecretsQueryKeys.All(TEAM_ID),
      });
    });

    it("sends a description that was changed", async () => {
      const { user } = renderForm({ existingSecret: existing });

      await user.type(field("New Secret Value"), "n3w");
      await user.clear(field("Description (optional)"));
      await user.type(field("Description (optional)"), "Agent model access");
      await user.click(screen.getByRole("button", { name: "Update Secret" }));

      await waitFor(() =>
        expect(updateSecret).toHaveBeenCalledWith(
          "API_KEY",
          expect.objectContaining({ description: "Agent model access" }),
          undefined,
        ),
      );
    });

    it("names the current expiry by its UTC day and keeps it when left empty", async () => {
      const { user } = renderForm({
        existingSecret: {
          ...existing,
          expiresAt: new Date("2027-03-03T02:00:00Z"),
        },
      });

      expect(field("Expires (optional)")).toHaveAccessibleDescription(
        "Currently Mar 3, 2027. Leave empty to keep that date.",
      );

      await user.type(field("New Secret Value"), "n3w");
      await user.click(screen.getByRole("button", { name: "Update Secret" }));

      await waitFor(() =>
        expect(updateSecret).toHaveBeenCalledWith(
          "API_KEY",
          expect.objectContaining({ expiresAt: undefined }),
          undefined,
        ),
      );
    });

    it("shows the backend's reason when replacing as the team is refused", async () => {
      vi.mocked(updateSecret).mockRejectedValue(
        new TeamImpersonationError(REFUSAL, 403),
      );
      const { user, onSuccess } = renderForm({
        existingSecret: existing,
        teamId: TEAM_ID,
      });

      await user.type(field("New Secret Value"), "n3w");
      await user.click(screen.getByRole("button", { name: "Update Secret" }));

      await waitFor(() =>
        expect(notify).toHaveBeenCalledWith(REFUSAL, "error"),
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("still needs a new value", () => {
      renderForm({ existingSecret: existing });

      expect(
        screen.getByRole("button", { name: "Update Secret" }),
      ).toBeDisabled();
    });
  });
});

describe("lastWholeSecondOfDayUTC", () => {
  it("keeps the local day of an evening when UTC is already on the next one", () => {
    const christmasEvening = new Date(2026, 11, 25, 21, 0);

    expect(lastWholeSecondOfDayUTC(christmasEvening).toISOString()).toBe(
      "2026-12-25T23:59:59.000Z",
    );
  });
});
