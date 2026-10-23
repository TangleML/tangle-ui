import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addSecret, updateSecret } from "../secretsStorage";
import type { Secret } from "../types";
import { AddSecretForm } from "./AddSecretForm";

vi.mock("../secretsStorage", () => ({
  addSecret: vi.fn(),
  updateSecret: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const existing: Secret = {
  id: "API_KEY",
  name: "API_KEY",
  description: "Model access",
  createdAt: new Date("2026-10-01T09:00:00Z"),
  updatedAt: new Date("2026-10-02T09:00:00Z"),
};

function renderForm(existingSecret?: Secret) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onSuccess = vi.fn();
  render(
    <AddSecretForm
      existingSecret={existingSecret}
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
  return { user: userEvent.setup(), onSuccess };
}

const field = (label: string) => screen.getByLabelText(label);

describe("AddSecretForm", () => {
  beforeEach(() => {
    vi.mocked(addSecret).mockResolvedValue(true);
    vi.mocked(updateSecret).mockResolvedValue(true);
  });

  afterEach(() => {
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
      expect(addSecret).toHaveBeenCalledWith({
        name: "API_KEY",
        value: "s3cret",
        description: "Model access",
        expiresAt: undefined,
      });
    });

    it("leaves out a description that was never written", async () => {
      const { user } = renderForm();

      await user.type(field("Secret Name"), "API_KEY");
      await user.type(field("Secret Value"), "s3cret");
      await user.click(screen.getByRole("button", { name: "Add Secret" }));

      await waitFor(() =>
        expect(addSecret).toHaveBeenCalledWith(
          expect.objectContaining({ description: undefined }),
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

    it("keeps the browser from filling the value with a saved password", () => {
      renderForm();

      expect(field("Secret Value")).toHaveAttribute("type", "password");
      expect(field("Secret Value")).toHaveAttribute(
        "autocomplete",
        "new-password",
      );
    });

    it("sends the expiry as the last whole second of the chosen day in UTC", async () => {
      const now = new Date();
      const chosen = new Date(now.getFullYear(), now.getMonth() + 1, 15);
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
            expiresAt: new Date(
              Date.UTC(
                chosen.getFullYear(),
                chosen.getMonth(),
                chosen.getDate(),
                23,
                59,
                59,
              ),
            ),
          }),
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
      renderForm(existing);

      expect(field("Secret Name")).toBeDisabled();
      expect(field("Description (optional)")).toHaveValue("Model access");
      expect(field("Description (optional)")).toHaveAccessibleDescription(
        "It can be changed but not removed.",
      );
    });

    it("sends only the new value when nothing else changed", async () => {
      const { user, onSuccess } = renderForm(existing);

      await user.type(field("New Secret Value"), "n3w");
      await user.click(screen.getByRole("button", { name: "Update Secret" }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
      expect(updateSecret).toHaveBeenCalledWith("API_KEY", {
        id: "API_KEY",
        value: "n3w",
        description: undefined,
        expiresAt: undefined,
      });
    });

    it("sends a description that was changed", async () => {
      const { user } = renderForm(existing);

      await user.type(field("New Secret Value"), "n3w");
      await user.clear(field("Description (optional)"));
      await user.type(field("Description (optional)"), "Agent model access");
      await user.click(screen.getByRole("button", { name: "Update Secret" }));

      await waitFor(() =>
        expect(updateSecret).toHaveBeenCalledWith(
          "API_KEY",
          expect.objectContaining({ description: "Agent model access" }),
        ),
      );
    });

    it("names the current expiry and keeps it when left empty", () => {
      renderForm({ ...existing, expiresAt: new Date("2027-03-03T23:59:59Z") });

      expect(field("Expires (optional)")).toHaveAccessibleDescription(
        "Currently Mar 3, 2027. Leave empty to keep that date.",
      );
    });

    it("still needs a new value", () => {
      renderForm(existing);

      expect(
        screen.getByRole("button", { name: "Update Secret" }),
      ).toBeDisabled();
    });
  });
});
