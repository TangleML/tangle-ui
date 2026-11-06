import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectResource } from "@/services/projects/types";
import { useUpdateProjectResource } from "@/services/projects/useProjectResources";

import { documentBody, DocumentEditor } from "./DocumentEditor";

vi.mock("@/services/projects/useProjectResources", () => ({
  useUpdateProjectResource: vi.fn(),
}));

vi.mock("@/components/shared/CodeViewer/CodeEditor", () => ({
  default: ({
    value,
    language,
    onChange,
    options,
  }: {
    value: string;
    language: string;
    onChange: (value: string) => void;
    options: { ariaLabel: string };
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      data-language={language}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

type Mutate = ReturnType<typeof useUpdateProjectResource>["mutate"];

const mutate = vi.fn<Mutate>();

function givenUpdate({ isPending = false } = {}) {
  vi.mocked(useUpdateProjectResource).mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof useUpdateProjectResource>);
}

function resource(overrides: Partial<ProjectResource> = {}): ProjectResource {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "notes.md",
    entityId: null,
    metadata: { type: "document" },
    createdBy: "alice@example.com",
    createdAt: new Date("2026-09-09T10:00:00Z"),
    updatedAt: new Date("2026-09-09T10:00:00Z"),
    payload: { content: "# Notes" },
    ...overrides,
  };
}

const editor = () => screen.getByRole("textbox", { name: "notes.md" });
const saveButton = () => screen.getByRole("button", { name: /^Sav/ });
const discardButton = () => screen.getByRole("button", { name: "Discard" });

function renderEditor(initial = resource()) {
  givenUpdate();
  const view = render(
    <DocumentEditor projectId="project-1" resource={initial} />,
  );
  return {
    rerenderWith: (next: ProjectResource) =>
      view.rerender(<DocumentEditor projectId="project-1" resource={next} />),
  };
}

async function type(text: string) {
  await userEvent.clear(editor());
  if (text !== "") await userEvent.type(editor(), text);
}

function saveLands() {
  const options = mutate.mock.calls.at(-1)?.[1];
  if (!options?.onSuccess) throw new Error("save did not pass onSuccess");
  const onSuccess = options.onSuccess as unknown as () => void;
  act(() => onSuccess());
}

describe("documentBody", () => {
  it("reads the content string", () => {
    expect(documentBody({ payload: { content: "hi" } })).toBe("hi");
  });

  it("reads anything else as empty, so it can be written into", () => {
    expect(documentBody({ payload: {} })).toBe("");
    expect(documentBody({ payload: null })).toBe("");
    expect(documentBody({ payload: { content: 3 } })).toBe("");
  });
});

describe("DocumentEditor", () => {
  afterEach(() => vi.resetAllMocks());

  it("opens on the saved body with nothing to save", () => {
    renderEditor();

    expect(editor()).toHaveValue("# Notes");
    expect(editor()).toHaveAttribute("data-language", "markdown");
    expect(saveButton()).toBeDisabled();
    expect(discardButton()).toBeDisabled();
    expect(screen.queryByText("Unsaved changes")).toBeNull();
  });

  it("saves what was typed into the payload, keeping the rest of it", async () => {
    renderEditor(resource({ payload: { content: "# Notes", author: "al" } }));

    await type("# Revised");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await userEvent.click(saveButton());

    expect(mutate).toHaveBeenCalledWith(
      {
        resourceId: "resource-1",
        input: { payload: { author: "al", content: "# Revised" } },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("is clean again once the save lands", async () => {
    const { rerenderWith } = renderEditor();

    await type("# Revised");
    await userEvent.click(saveButton());
    rerenderWith(resource({ payload: { content: "# Revised" } }));
    saveLands();

    expect(editor()).toHaveValue("# Revised");
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText("Unsaved changes")).toBeNull();
  });

  it("keeps what was typed while the save was in flight", async () => {
    const { rerenderWith } = renderEditor();

    await type("# Revised");
    await userEvent.click(saveButton());
    await userEvent.type(editor(), " again");
    rerenderWith(resource({ payload: { content: "# Revised" } }));
    saveLands();

    expect(editor()).toHaveValue("# Revised again");
    expect(saveButton()).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("saves on Cmd+S and Ctrl+S", async () => {
    renderEditor();

    await type("# Revised");
    fireEvent.keyDown(editor(), { key: "s", metaKey: true });
    fireEvent.keyDown(editor(), { key: "s", ctrlKey: true });

    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it("ignores Cmd+S with nothing to save", () => {
    renderEditor();

    fireEvent.keyDown(editor(), { key: "s", metaKey: true });

    expect(mutate).not.toHaveBeenCalled();
  });

  it("does not save twice while one save is pending", async () => {
    givenUpdate({ isPending: true });
    render(<DocumentEditor projectId="project-1" resource={resource()} />);

    await type("# Revised");

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    fireEvent.keyDown(editor(), { key: "s", metaKey: true });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("discards back to the saved body", async () => {
    renderEditor();

    await type("# Revised");
    await userEvent.click(discardButton());

    expect(editor()).toHaveValue("# Notes");
    expect(saveButton()).toBeDisabled();
  });

  it("has nothing to save once the text is typed back to what was saved", async () => {
    renderEditor();

    await type("# Revised");
    await type("# Notes");

    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText("Unsaved changes")).toBeNull();
  });

  it("follows a save made elsewhere while nothing has been typed", () => {
    const { rerenderWith } = renderEditor();

    rerenderWith(resource({ payload: { content: "# From the agent" } }));

    expect(editor()).toHaveValue("# From the agent");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces a save made elsewhere while typing, and discards into it", async () => {
    const { rerenderWith } = renderEditor();

    await type("# Mine");
    rerenderWith(resource({ payload: { content: "# From the agent" } }));

    expect(editor()).toHaveValue("# Mine");
    expect(screen.getByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(saveButton()).toBeEnabled();

    await userEvent.click(discardButton());

    expect(editor()).toHaveValue("# From the agent");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("opens an empty document ready to be written into", async () => {
    renderEditor(resource({ name: null, payload: {} }));

    const empty = screen.getByRole("textbox", { name: "Untitled" });
    expect(empty).toHaveValue("");

    await userEvent.type(empty, "First line");

    expect(saveButton()).toBeEnabled();
  });
});
