import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentDescriptorType } from "@/services/projects/resourceDescriptor";

import { DocumentForm } from "./DocumentForm";

const track = vi.fn();

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
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

const titleField = () => screen.getByLabelText("Title");
const contentField = () => screen.getByLabelText("Content");
const form = () => titleField().closest("form") as HTMLFormElement;
const draggingHint = () =>
  screen.queryByText("Drop to fill in the title and content");

function renderForm({
  isSubmitting = false,
  kind,
  onSubmit = vi.fn(),
}: {
  isSubmitting?: boolean;
  kind?: DocumentDescriptorType;
  onSubmit?: (input: unknown) => void;
} = {}) {
  render(
    <DocumentForm
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      isSubmitting={isSubmitting}
      kind={kind}
    />,
  );
}

function fileDrag(...files: File[]) {
  return { dataTransfer: { files, types: ["Files"] } };
}

const modelCard = () => new File(["Trained on Q3 data"], "model-card.md");

function fileReadOnCue(text: string, name: string) {
  const file = new File([text], name);
  let finishReading = () => {};
  const bytes = new Promise<ArrayBuffer>((resolve) => {
    finishReading = () => resolve(new TextEncoder().encode(text).buffer);
  });
  vi.spyOn(file, "arrayBuffer").mockReturnValue(bytes);
  return { file, finishReading };
}

const addButton = () => screen.getByRole("button", { name: "Add" });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("DocumentForm file drop", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("fills the title and content from a dropped file", async () => {
    renderForm();

    fireEvent.drop(contentField(), fileDrag(modelCard()));

    await waitFor(() => {
      expect(contentField()).toHaveValue("Trained on Q3 data");
    });
    expect(titleField()).toHaveValue("model-card.md");
    expect(track).toHaveBeenCalledWith(
      "projects.add_document_from_file_completed",
      { method: "drop", kind: "document" },
    );
  });

  it("highlights the content as the title's extension says, as the saved document will be", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(contentField()).toHaveAttribute("data-language", "plaintext");

    await user.type(titleField(), "train.py");
    expect(contentField()).toHaveAttribute("data-language", "python");
  });

  it("fills the title and content from a browsed file", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.upload(screen.getByTestId("document-file-input"), modelCard());

    await waitFor(() => {
      expect(contentField()).toHaveValue("Trained on Q3 data");
    });
    expect(titleField()).toHaveValue("model-card.md");
    expect(track).toHaveBeenCalledWith(
      "projects.add_document_from_file_completed",
      { method: "browse", kind: "document" },
    );
  });

  it("keeps a title the user typed", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(titleField(), "Q3 model card");
    fireEvent.drop(form(), fileDrag(modelCard()));

    await waitFor(() => {
      expect(contentField()).toHaveValue("Trained on Q3 data");
    });
    expect(titleField()).toHaveValue("Q3 model card");
  });

  it("replaces a title it took from an earlier file", async () => {
    renderForm();

    fireEvent.drop(form(), fileDrag(new File(["wrong"], "wrong-file.txt")));
    await waitFor(() => {
      expect(titleField()).toHaveValue("wrong-file.txt");
    });

    fireEvent.drop(form(), fileDrag(modelCard()));
    await waitFor(() => {
      expect(titleField()).toHaveValue("model-card.md");
    });
    expect(contentField()).toHaveValue("Trained on Q3 data");
  });

  it("keeps the later file when an earlier one finishes reading last", async () => {
    renderForm();
    const first = fileReadOnCue("first draft", "first.md");
    const second = fileReadOnCue("second draft", "second.md");

    fireEvent.drop(form(), fileDrag(first.file));
    fireEvent.drop(form(), fileDrag(second.file));

    second.finishReading();
    await waitFor(() => {
      expect(contentField()).toHaveValue("second draft");
    });

    await act(async () => {
      first.finishReading();
      await settle();
    });
    expect(contentField()).toHaveValue("second draft");
    expect(titleField()).toHaveValue("second.md");
  });

  it("holds off adding until a dropped file has been read", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(titleField(), "notes.md");
    await user.type(contentField(), "Draft");
    expect(addButton()).toBeEnabled();

    const slow = fileReadOnCue("Trained on Q3 data", "model-card.md");
    fireEvent.drop(form(), fileDrag(slow.file));
    expect(addButton()).toBeDisabled();

    slow.finishReading();
    await waitFor(() => {
      expect(addButton()).toBeEnabled();
    });
    expect(contentField()).toHaveValue("Trained on Q3 data");
  });

  it("says why a file that isn't text can't be added, and leaves the fields alone", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(contentField(), "Draft");
    fireEvent.drop(
      form(),
      fileDrag(new File([new Uint8Array([0xff, 0xfe, 0x00])], "chart.png")),
    );

    expect(
      await screen.findByText(
        "chart.png isn't a text file. Only text files can be added.",
      ),
    ).toBeInTheDocument();
    expect(contentField()).toHaveValue("Draft");
    expect(titleField()).toHaveValue("");
  });

  it("clears the error once a readable file arrives", async () => {
    renderForm();

    fireEvent.drop(
      form(),
      fileDrag(new File([new Uint8Array([0xff])], "chart.png")),
    );
    await screen.findByText(/chart\.png isn't a text file/);

    fireEvent.drop(form(), fileDrag(modelCard()));
    await waitFor(() => {
      expect(screen.queryByText(/chart\.png isn't a text file/)).toBeNull();
    });
  });

  it("ignores a file dropped while the document is saving", async () => {
    renderForm({ isSubmitting: true });

    fireEvent.drop(form(), fileDrag(modelCard()));

    await waitFor(() => {
      expect(track).not.toHaveBeenCalled();
    });
    expect(contentField()).toHaveValue("");
  });

  it("highlights while a file is dragged over the form", () => {
    renderForm();

    fireEvent.dragEnter(form(), fileDrag());
    expect(draggingHint()).toBeInTheDocument();

    fireEvent.dragLeave(form(), fileDrag());
    expect(draggingHint()).toBeNull();
  });
});

describe("DocumentForm kinds", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("adds a document by default, filed under its title", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm({ onSubmit });

    await user.type(titleField(), "Model card");
    await user.type(contentField(), "Trained on Q3");
    await user.click(addButton());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Model card",
        metadata: { type: "document" },
      }),
    );
  });

  it("adds code by its filename, filed as code", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm({ kind: "code", onSubmit });

    const filename = screen.getByLabelText("Filename");
    expect(filename).toHaveAttribute("placeholder", "train.py");
    expect(screen.queryByLabelText("Title")).toBeNull();

    await user.type(filename, "train.py");
    await user.type(contentField(), "print(1)");
    expect(contentField()).toHaveAttribute("data-language", "python");

    await user.click(addButton());

    expect(onSubmit).toHaveBeenCalledWith({
      entity: "document",
      name: "train.py",
      payload: { content: "print(1)" },
      metadata: { type: "code" },
    });
  });

  it("names the filename, not a title, while a file is dragged over code", () => {
    renderForm({ kind: "code" });

    fireEvent.dragEnter(screen.getByLabelText("Filename"), fileDrag());

    expect(
      screen.getByText("Drop to fill in the filename and content"),
    ).toBeInTheDocument();
    expect(draggingHint()).toBeNull();
  });

  it("says which kind is being browsed for", () => {
    renderForm({ kind: "code" });

    expect(screen.getByRole("button", { name: "browse" })).toHaveAttribute(
      "data-tracking-metadata",
      JSON.stringify({ kind: "code" }),
    );
  });

  it("says which kind a dropped file became", async () => {
    renderForm({ kind: "code" });

    fireEvent.drop(contentField(), fileDrag(modelCard()));

    await waitFor(() => {
      expect(contentField()).toHaveValue("Trained on Q3 data");
    });
    expect(track).toHaveBeenCalledWith(
      "projects.add_document_from_file_completed",
      { method: "drop", kind: "code" },
    );
  });
});
