import "fake-indexeddb/auto";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { FavoriteToggle } from "./FavoriteToggle";

afterEach(async () => {
  cleanup();
  await LibraryDB.favorites.clear();
});

describe("FavoriteToggle legacy pipeline favorites", () => {
  it("keeps a stable local favorite starred in the legacy editor", async () => {
    await LibraryDB.favorites.put({
      type: "pipeline",
      id: "document-id",
      name: "Daily report",
      pipelineReferenceId: "Daily report",
    });
    render(
      <FavoriteToggle type="pipeline" id="Daily report" name="Daily report" />,
    );
    const button = await screen.findByRole("button", {
      name: "Remove Daily report from favorites",
      pressed: true,
    });

    fireEvent.click(button);

    await waitFor(() =>
      expect(button).toHaveAttribute("aria-pressed", "false"),
    );
    expect(await LibraryDB.favorites.toArray()).toEqual([]);
  });

  it.each(["Daily report", "remote:https%3A%2F%2Fbackend.example:pipeline-id"])(
    "shows the existing %s favorite and removes it with one click",
    async (pipelineReferenceId) => {
      await LibraryDB.favorites.put({
        type: "pipeline",
        id: pipelineReferenceId,
        name: "Daily report",
      });
      render(
        <FavoriteToggle
          type="pipeline"
          id="document-id"
          name="Daily report"
          pipelineReferenceId={pipelineReferenceId}
        />,
      );
      const button = await screen.findByRole("button", {
        name: "Remove Daily report from favorites",
        pressed: true,
      });

      fireEvent.click(button);

      await waitFor(() =>
        expect(button).toHaveAttribute("aria-pressed", "false"),
      );
      expect(await LibraryDB.favorites.toArray()).toEqual([]);
    },
  );
});
