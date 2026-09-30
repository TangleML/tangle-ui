import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateProjectResource } from "@/services/projects/useProjectResources";

import { AddDocumentDialog } from "./AddDocumentDialog";

const mutate = vi.fn();
const notify = vi.fn();
const track = vi.fn();

vi.mock("@/services/projects/useProjectResources", () => ({
  useCreateProjectResource: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

function mockCreate({ isPending = false } = {}) {
  vi.mocked(useCreateProjectResource).mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useCreateProjectResource>);
}

function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <AddDocumentDialog
        projectId="project-1"
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

async function openDialog() {
  const user = userEvent.setup();
  render(<Harness />);

  await user.click(screen.getByRole("button", { name: "Open" }));
  await screen.findByRole("dialog");

  return user;
}

const titleField = () => screen.getByLabelText("Title");
const contentField = () => screen.getByLabelText("Content");
const addButton = () => screen.getByRole("button", { name: "Add" });

describe("AddDocumentDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    mockCreate();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("adds a document as a payload the backend will accept", async () => {
    const user = await openDialog();

    await user.type(titleField(), "Model card");
    await user.type(contentField(), "Trained on Q3 data");
    await user.click(addButton());

    expect(mutate).toHaveBeenCalledWith(
      {
        entity: "document",
        name: "Model card",
        payload: { content: "Trained on Q3 data" },
      },
      expect.anything(),
    );
  });

  it("never sends an entity_id, which a document may not carry", async () => {
    const user = await openDialog();

    await user.type(titleField(), "Model card");
    await user.type(contentField(), "Body");
    await user.click(addButton());

    const [input] = mutate.mock.calls[0];
    expect(input).not.toHaveProperty("entityId");
    expect(input).not.toHaveProperty("entity_id");
  });

  it("refuses a document with no title", async () => {
    const user = await openDialog();

    await user.type(contentField(), "Body with no title");

    expect(addButton()).toBeDisabled();
  });

  it("refuses a document with no content, which the backend requires", async () => {
    const user = await openDialog();

    await user.type(titleField(), "Title with no body");

    expect(addButton()).toBeDisabled();
  });

  it("refuses fields that hold only whitespace", async () => {
    const user = await openDialog();

    await user.type(titleField(), "   ");
    await user.type(contentField(), "   ");

    expect(addButton()).toBeDisabled();
  });

  it("trims what it sends", async () => {
    const user = await openDialog();

    await user.type(titleField(), "  Model card  ");
    await user.type(contentField(), "  Body  ");
    await user.click(addButton());

    expect(mutate).toHaveBeenCalledWith(
      {
        entity: "document",
        name: "Model card",
        payload: { content: "Body" },
      },
      expect.anything(),
    );
  });

  it("closes and says so once the document lands", async () => {
    const user = await openDialog();

    await user.type(titleField(), "Model card");
    await user.type(contentField(), "Body");
    await user.click(addButton());

    const [, options] = mutate.mock.calls[0];
    await act(async () => options.onSuccess());

    expect(notify).toHaveBeenCalledWith("Document added", "success");
    expect(track).toHaveBeenCalledWith("projects.add_document_completed");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("forgets a draft that was cancelled", async () => {
    const user = await openDialog();

    await user.type(titleField(), "Abandoned");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByLabelText("Title")).toHaveValue("");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("cannot be submitted twice while saving", async () => {
    mockCreate({ isPending: true });
    const user = await openDialog();

    await user.type(titleField(), "Model card");
    await user.type(contentField(), "Body");

    expect(addButton()).toBeDisabled();
  });
});
