import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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

function renderForm({ isSubmitting = false } = {}) {
  render(
    <DocumentForm
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      isSubmitting={isSubmitting}
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
      { method: "drop" },
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
      { method: "browse" },
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
        "chart.png isn't a text file. Only text can be added as a document.",
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
