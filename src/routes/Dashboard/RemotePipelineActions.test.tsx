import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRemotePipelineWriter } from "@/services/remotePipelineEditorService";
import { RemotePipelineQueryKeys } from "@/services/remotePipelineQueryKeys";
import {
  deleteRemotePipeline,
  type RemotePipeline,
} from "@/services/remotePipelinesService";

import { RemotePipelineActions } from "./RemotePipelineActions";

const { favorites, removeRecent, notify } = vi.hoisted(() => ({
  favorites: {
    isFavorite: vi.fn(),
    toggleFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  },
  removeRecent: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/hooks/useFavorites", () => ({ useFavorites: () => favorites }));
vi.mock("@/hooks/useRecentlyViewed", () => ({
  removeRecentlyViewed: removeRecent,
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("@/services/remotePipelineEditorService", () => ({
  getRemotePipelineWriter: vi.fn(),
}));
vi.mock("@/services/remotePipelinesService", () => ({
  deleteRemotePipeline: vi.fn(),
}));

const backendUrl = "https://backend.example.com";
const otherBackendUrl = "https://other.example.com";
const pipeline: RemotePipeline = {
  id: "pipeline-id",
  user_id: "owner@example.com",
  pipeline_name: "Saved pipeline",
  created_at: "2026-10-20T10:00:00Z",
  updated_at: "2026-10-20T10:00:00Z",
  current_version: "version-1",
  file_path: "pipelines/saved.yaml",
  versioning_mode: "full",
};

const clients: QueryClient[] = [];

function renderActions() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const openPipeline = vi.fn();
  const view = (backend: string) => (
    <QueryClientProvider client={client}>
      <table>
        <tbody>
          <tr onClick={openPipeline}>
            <td>
              <RemotePipelineActions
                key={backend}
                backendUrl={backend}
                pipeline={pipeline}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </QueryClientProvider>
  );
  const rendered = render(view(backendUrl));
  return {
    client,
    openPipeline,
    user: userEvent.setup(),
    rerender: (backend = backendUrl) => rendered.rerender(view(backend)),
  };
}

async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: "Delete Saved pipeline" }),
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  vi.mocked(getRemotePipelineWriter).mockResolvedValue(pipeline.user_id);
  vi.mocked(deleteRemotePipeline).mockResolvedValue(undefined);
  favorites.isFavorite.mockReturnValue(false);
  favorites.removeFavorite.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.resetAllMocks();
});

describe("RemotePipelineActions", () => {
  it.each([false, true])(
    "toggles the stable remote identity without opening the row (favorite: %s)",
    async (active) => {
      favorites.isFavorite.mockReturnValue(active);
      const { user, openPipeline } = renderActions();
      const button = screen.getByRole("button", {
        name: active
          ? "Remove Saved pipeline from favorites"
          : "Add Saved pipeline to favorites",
      });
      expect(button).toHaveAttribute("aria-pressed", String(active));
      expect(favorites.isFavorite).toHaveBeenCalledWith(
        "remote-pipeline",
        pipeline.id,
      );

      if (active) {
        button.focus();
        await user.keyboard("{Enter}");
      } else {
        await user.click(button);
      }
      expect(favorites.toggleFavorite).toHaveBeenCalledExactlyOnceWith({
        type: "remote-pipeline",
        id: pipeline.id,
        name: pipeline.pipeline_name,
      });
      expect(openPipeline).not.toHaveBeenCalled();
    },
  );

  it.each(["another owner", "no write permission"])(
    "keeps favorites available and hides deletion for %s",
    async (reason) => {
      const permission = Promise.withResolvers<string>();
      vi.mocked(getRemotePipelineWriter).mockReturnValue(permission.promise);
      const { client } = renderActions();
      expect(
        screen.queryByRole("button", { name: "Delete Saved pipeline" }),
      ).not.toBeInTheDocument();

      await act(async () => {
        if (reason === "another owner") permission.resolve("other@example.com");
        else
          permission.reject(
            new Error("You do not have permission to edit pipelines."),
          );
      });
      await waitFor(() => expect(client.isFetching()).toBe(0));
      expect(
        screen.queryByRole("button", { name: "Delete Saved pipeline" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Add Saved pipeline to favorites" }),
      ).toBeEnabled();
    },
  );

  it("cancels deletion without opening the row or changing saved associations", async () => {
    const { user, openPipeline } = renderActions();
    await user.click(
      await screen.findByRole("button", { name: "Delete Saved pipeline" }),
    );
    expect(
      screen.getByRole("alertdialog", {
        name: 'Delete pipeline "Saved pipeline"?',
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByText(/This deletes the saved pipeline\./));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteRemotePipeline).not.toHaveBeenCalled();
    expect(favorites.removeFavorite).not.toHaveBeenCalled();
    expect(removeRecent).not.toHaveBeenCalled();
    expect(openPipeline).not.toHaveBeenCalled();
  });

  it("blocks repeat actions while deleting and refreshes only this backend after cleanup", async () => {
    const deletion = Promise.withResolvers<void>();
    vi.mocked(deleteRemotePipeline).mockReturnValue(deletion.promise);
    const { user, client, openPipeline } = renderActions();
    const firstCursorKey = RemotePipelineQueryKeys.Cursor(
      backendUrl,
      undefined,
      undefined,
    );
    const nextCursorKey = RemotePipelineQueryKeys.Cursor(
      backendUrl,
      undefined,
      "next",
    );
    const otherKey = RemotePipelineQueryKeys.Cursor(
      otherBackendUrl,
      undefined,
      undefined,
    );
    for (const key of [firstCursorKey, nextCursorKey, otherKey])
      client.setQueryData(key, {});

    await confirmDelete(user);
    const deleteButton = screen.getByRole("button", {
      name: "Delete Saved pipeline",
    });
    expect(deleteButton).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Add Saved pipeline to favorites" }),
    ).toBeDisabled();
    await user.click(deleteButton);
    expect(deleteRemotePipeline).toHaveBeenCalledExactlyOnceWith(
      backendUrl,
      pipeline,
    );
    expect(favorites.removeFavorite).not.toHaveBeenCalled();
    expect(removeRecent).not.toHaveBeenCalled();

    await act(async () => deletion.resolve());
    await waitFor(() =>
      expect(client.getQueryState(firstCursorKey)?.isInvalidated).toBe(true),
    );
    expect(client.getQueryState(nextCursorKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(otherKey)?.isInvalidated).toBe(false);
    expect(favorites.removeFavorite).toHaveBeenCalledExactlyOnceWith(
      "remote-pipeline",
      pipeline.id,
    );
    expect(removeRecent).toHaveBeenCalledExactlyOnceWith(
      "remote-pipeline",
      pipeline.id,
    );
    expect(openPipeline).not.toHaveBeenCalled();
  });

  it("keeps actions guarded after the row remounts during deletion", async () => {
    const deletion = Promise.withResolvers<void>();
    vi.mocked(deleteRemotePipeline).mockReturnValue(deletion.promise);
    const { user, rerender } = renderActions();
    await confirmDelete(user);
    rerender(otherBackendUrl);
    await screen.findByRole("button", { name: "Delete Saved pipeline" });
    rerender(backendUrl);
    const trigger = await screen.findByRole("button", {
      name: "Delete Saved pipeline",
    });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Add Saved pipeline to favorites" }),
    ).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(deleteRemotePipeline).toHaveBeenCalledOnce();
    await act(async () => deletion.resolve());
  });

  it("preserves favorites and history and reports a failed delete", async () => {
    favorites.isFavorite.mockReturnValue(true);
    vi.mocked(deleteRemotePipeline).mockRejectedValue(
      new Error("Failed to delete pipeline (503)"),
    );
    const { user, client } = renderActions();
    const cursorKey = RemotePipelineQueryKeys.Cursor(
      backendUrl,
      undefined,
      undefined,
    );
    client.setQueryData(cursorKey, {});

    await confirmDelete(user);
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "Failed to delete pipeline (503)",
        "error",
      ),
    );
    expect(favorites.removeFavorite).not.toHaveBeenCalled();
    expect(removeRecent).not.toHaveBeenCalled();
    expect(client.getQueryState(cursorKey)?.isInvalidated).toBe(false);
    expect(
      screen.getByRole("button", {
        name: "Remove Saved pipeline from favorites",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Delete Saved pipeline" }),
    ).toHaveAttribute("aria-disabled", "false");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Delete Saved pipeline" }),
      ).toHaveFocus(),
    );
  });

  it("rechecks write access on backend changes without retargeting a pending delete", async () => {
    const deletion = Promise.withResolvers<void>();
    vi.mocked(deleteRemotePipeline).mockReturnValue(deletion.promise);
    vi.mocked(getRemotePipelineWriter).mockImplementation(async (url) =>
      url === backendUrl ? pipeline.user_id : "other@example.com",
    );
    const { user, client, rerender } = renderActions();
    const oldKey = RemotePipelineQueryKeys.Cursor(
      backendUrl,
      undefined,
      undefined,
    );
    const newKey = RemotePipelineQueryKeys.Cursor(
      otherBackendUrl,
      undefined,
      undefined,
    );
    client.setQueryData(oldKey, {});
    client.setQueryData(newKey, {});

    await confirmDelete(user);
    rerender(otherBackendUrl);
    await waitFor(() =>
      expect(getRemotePipelineWriter).toHaveBeenCalledWith(otherBackendUrl),
    );
    expect(
      screen.queryByRole("button", { name: "Delete Saved pipeline" }),
    ).not.toBeInTheDocument();
    await act(async () => deletion.resolve());
    await waitFor(() =>
      expect(client.getQueryState(oldKey)?.isInvalidated).toBe(true),
    );
    expect(client.getQueryState(newKey)?.isInvalidated).toBe(false);
    expect(deleteRemotePipeline).toHaveBeenCalledExactlyOnceWith(
      backendUrl,
      pipeline,
    );
  });

  it.each(["favorites", "history"])(
    "still refreshes the list if clearing a deleted pipeline's %s fails",
    async (storage) => {
      if (storage === "favorites") {
        favorites.removeFavorite.mockRejectedValue(
          new Error("Storage unavailable"),
        );
      } else {
        removeRecent.mockImplementation(() => {
          throw new Error("Storage unavailable");
        });
      }
      const { user, client } = renderActions();
      const cursorKey = RemotePipelineQueryKeys.Cursor(
        backendUrl,
        undefined,
        undefined,
      );
      client.setQueryData(cursorKey, {});

      await confirmDelete(user);
      await waitFor(() =>
        expect(client.getQueryState(cursorKey)?.isInvalidated).toBe(true),
      );
      expect(notify).toHaveBeenCalledWith(
        "Pipeline deleted, but its local favorites or history could not be updated.",
        "warning",
      );
      expect(removeRecent).toHaveBeenCalledWith("remote-pipeline", pipeline.id);
    },
  );
});
