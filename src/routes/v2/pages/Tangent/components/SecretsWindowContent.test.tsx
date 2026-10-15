import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceSecretDialog } from "@/components/WorkspaceSecrets/WorkspaceSecretDialog";
import type {
  Project,
  Workspace,
  WorkspaceSecret,
} from "@/services/projects/types";
import { useProject } from "@/services/projects/useProjects";
import { useWorkspace } from "@/services/projects/useWorkspaces";
import {
  useDeleteWorkspaceSecret,
  useWorkspaceSecrets,
} from "@/services/projects/useWorkspaceSecrets";

import { SecretsWindowContent } from "./SecretsWindowContent";

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ projectId: "project-1" }),
}));

vi.mock("@/services/projects/useProjects", () => ({ useProject: vi.fn() }));
vi.mock("@/services/projects/useWorkspaces", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/services/projects/useWorkspaceSecrets", () => ({
  useWorkspaceSecrets: vi.fn(),
  useDeleteWorkspaceSecret: vi.fn(),
}));

const open = vi.fn();
vi.mock("@/providers/DialogProvider/hooks/useDialog", () => ({
  useDialog: () => ({ open }),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

const deleteSecret = vi.fn();

const secret = (
  name: string,
  overrides: Partial<WorkspaceSecret> = {},
): WorkspaceSecret => ({
  name,
  description: null,
  expiresAt: null,
  createdAt: new Date("2026-10-01T09:00:00Z"),
  updatedAt: new Date("2026-10-02T09:00:00Z"),
  createdBy: "alice@example.com",
  canManage: false,
  ...overrides,
});

function givenProject(project: Partial<Project> | undefined) {
  vi.mocked(useProject).mockReturnValue({
    data: project,
  } as unknown as ReturnType<typeof useProject>);
}

function givenSecrets(
  secrets: WorkspaceSecret[] | undefined,
  {
    canCreate = true,
    isPending = false,
    error = null,
  }: { canCreate?: boolean; isPending?: boolean; error?: Error | null } = {},
) {
  vi.mocked(useWorkspaceSecrets).mockReturnValue({
    data: secrets ? { secrets, canCreate } : undefined,
    isPending,
    error,
  } as unknown as ReturnType<typeof useWorkspaceSecrets>);
}

async function openRowMenu(name: string) {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: `Secret actions: ${name}` }),
  );
  return user;
}

describe("SecretsWindowContent", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    givenProject({ id: "project-1", workspaceId: "ws-1" });
    vi.mocked(useWorkspace).mockReturnValue({
      data: { id: "ws-1", name: "ML Research" } as Workspace,
    } as unknown as ReturnType<typeof useWorkspace>);
    vi.mocked(useDeleteWorkspaceSecret).mockReturnValue({
      mutate: deleteSecret,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteWorkspaceSecret>);
    open.mockResolvedValue(undefined);
    givenSecrets([]);
  });

  afterEach(() => vi.resetAllMocks());

  it("asks about the workspace the project belongs to", () => {
    render(<SecretsWindowContent />);

    expect(useWorkspaceSecrets).toHaveBeenCalledWith("ws-1");
  });

  it("says the secrets are shared across the workspace", () => {
    render(<SecretsWindowContent />);

    expect(
      screen.getByText("Shared with every project in ML Research."),
    ).toBeVisible();
  });

  it("waits for the project before it can say which workspace", () => {
    givenProject(undefined);

    render(<SecretsWindowContent />);

    expect(screen.getByText("Loading...")).toBeVisible();
    expect(useWorkspaceSecrets).not.toHaveBeenCalled();
  });

  it("shows the list loading", () => {
    givenSecrets(undefined, { isPending: true });

    render(<SecretsWindowContent />);

    expect(screen.getByText("Loading...")).toBeVisible();
  });

  it("says why the list could not be loaded", () => {
    givenSecrets(undefined, {
      error: new Error("Failed to load secrets: Workspace not found"),
    });

    render(<SecretsWindowContent />);

    expect(screen.getByText("Error loading secrets")).toBeVisible();
    expect(
      screen.getByText("Failed to load secrets: Workspace not found"),
    ).toBeVisible();
  });

  it("says when the workspace has none", () => {
    render(<SecretsWindowContent />);

    expect(screen.getByText("No secrets in this workspace yet")).toBeVisible();
  });

  it("lists each secret with its description, or who added it", () => {
    givenSecrets([
      secret("API_KEY", { description: "Model access" }),
      secret("DB_PASSWORD"),
    ]);

    render(<SecretsWindowContent />);

    expect(screen.getByText("API_KEY")).toBeVisible();
    expect(screen.getByText("Model access")).toBeVisible();
    expect(screen.getByText("DB_PASSWORD")).toBeVisible();
    expect(
      screen.getByText(/^Added by alice@example\.com · updated /),
    ).toBeVisible();
  });

  it("never mentions when a secret expires", () => {
    givenSecrets([
      secret("API_KEY", { expiresAt: new Date("2026-12-31T23:59:59Z") }),
    ]);

    render(<SecretsWindowContent />);

    expect(screen.queryByText(/expir/i)).toBeNull();
  });

  it("offers to add a secret when the backend allows it", async () => {
    const user = userEvent.setup();
    render(<SecretsWindowContent />);

    await user.click(screen.getByRole("button", { name: "Add a secret" }));

    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        component: WorkspaceSecretDialog,
        props: { workspaceId: "ws-1", secret: undefined },
      }),
    );
  });

  it("offers no way to add one when the backend does not allow it", () => {
    givenSecrets([], { canCreate: false });

    render(<SecretsWindowContent />);

    expect(screen.queryByRole("button", { name: "Add a secret" })).toBeNull();
  });

  it("offers nothing to change on a secret someone else manages", () => {
    givenSecrets([secret("API_KEY", { canManage: false })]);

    render(<SecretsWindowContent />);

    expect(
      screen.queryByRole("button", { name: "Secret actions: API_KEY" }),
    ).toBeNull();
  });

  it("replaces the value of a secret the caller manages", async () => {
    const manageable = secret("API_KEY", { canManage: true });
    givenSecrets([manageable]);
    render(<SecretsWindowContent />);

    const user = await openRowMenu("API_KEY");
    await user.click(screen.getByRole("menuitem", { name: "Replace value" }));

    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        component: WorkspaceSecretDialog,
        props: { workspaceId: "ws-1", secret: manageable },
      }),
    );
  });

  it("asks before deleting a secret", async () => {
    givenSecrets([secret("API_KEY", { canManage: true })]);
    render(<SecretsWindowContent />);

    const user = await openRowMenu("API_KEY");
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(
      await screen.findByRole("alertdialog", { name: 'Delete "API_KEY"?' }),
    ).toBeVisible();
    expect(deleteSecret).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(deleteSecret).toHaveBeenCalledWith("API_KEY", expect.anything());
  });

  it("keeps the secret when the deletion is called off", async () => {
    givenSecrets([secret("API_KEY", { canManage: true })]);
    render(<SecretsWindowContent />);

    const user = await openRowMenu("API_KEY");
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(deleteSecret).not.toHaveBeenCalled();
  });
});
