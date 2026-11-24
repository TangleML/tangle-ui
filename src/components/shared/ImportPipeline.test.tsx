import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImportPipeline from "./ImportPipeline";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  track: vi.fn(),
  assignFile: vi.fn(),
  importPipelineFromYaml: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
}));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: state.track }),
}));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => ({ rootFolder: { assignFile: state.assignFile } }),
}));
vi.mock("@/services/pipelineService", () => ({
  importPipelineFromYaml: state.importPipelineFromYaml,
}));

const YAML_TEXT = "name: My pipeline";
const SYNTAX_ERROR =
  "YAML syntax error: unexpected end of the stream within a flow collection (2:1)";
const EXCERPT = " 1 | a: [\n 2 | \n-----^";

const yamlFile = () => new File([YAML_TEXT], "pipeline.yaml");

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Import Pipeline" }));
}

function pick(file: File) {
  fireEvent.change(screen.getByTestId("file-picker-input"), {
    target: { files: [file] },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  state.assignFile.mockResolvedValue({ id: "file-1" });
  state.importPipelineFromYaml.mockResolvedValue({
    name: "My pipeline",
    overwritten: false,
    successful: true,
  });
});

afterEach(() => {
  cleanup();
});

describe("ImportPipeline file import", () => {
  it("imports a valid .yaml file and offers Go to Pipeline, which navigates", async () => {
    render(<ImportPipeline />);
    openDialog();

    pick(yamlFile());

    const box = await screen.findByRole("status");
    expect(box).toHaveTextContent("Import successful");
    expect(box).toHaveTextContent("My pipeline imported");
    expect(state.importPipelineFromYaml).toHaveBeenCalledWith(
      expect.anything(),
      YAML_TEXT,
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to Pipeline" }));

    expect(state.navigate).toHaveBeenCalledWith({
      to: "/editor/My%20pipeline",
    });
  });

  it("closes the dialog when Go to Pipeline is selected", async () => {
    render(<ImportPipeline />);
    openDialog();
    pick(yamlFile());
    await screen.findByRole("status");

    fireEvent.click(screen.getByRole("button", { name: "Go to Pipeline" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("clears a paste error when a file is then imported", async () => {
    state.importPipelineFromYaml.mockResolvedValueOnce({
      name: "",
      overwritten: false,
      successful: false,
      errorMessage: "Pasted YAML is invalid",
    });
    render(<ImportPipeline />);
    openDialog();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Paste YAML" }));
    fireEvent.change(screen.getByLabelText("Pipeline YAML Content"), {
      target: { value: "a: [" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByText("Import Failed")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Import from File" }));
    pick(yamlFile());

    await screen.findByRole("status");
    expect(screen.queryByText("Import Failed")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Pasted YAML is invalid"),
    ).not.toBeInTheDocument();
  });

  it("tracks the completed import with method file", async () => {
    render(<ImportPipeline />);
    openDialog();

    pick(yamlFile());

    await screen.findByRole("status");
    expect(state.track).toHaveBeenCalledWith(
      "pipeline_editor.pipeline_actions.import_pipeline_completed",
      { method: "file" },
    );
  });

  it("refuses a .txt file with the extension message without importing it", async () => {
    render(<ImportPipeline />);
    openDialog();

    pick(new File([YAML_TEXT], "pipeline.txt"));

    const box = await screen.findByRole("alert");
    expect(box).toHaveTextContent("Import failed");
    expect(box).toHaveTextContent("pipeline.txt isn't a .yaml or .yml file.");
    expect(state.importPipelineFromYaml).not.toHaveBeenCalled();
    expect(state.track).not.toHaveBeenCalled();
  });

  it("shows a YAML syntax error with its excerpt in a pre", async () => {
    state.importPipelineFromYaml.mockResolvedValue({
      name: "",
      overwritten: false,
      successful: false,
      errorMessage: `${SYNTAX_ERROR}\n\n${EXCERPT}`,
    });
    render(<ImportPipeline />);
    openDialog();

    pick(yamlFile());

    const box = await screen.findByRole("alert");
    expect(box).toHaveTextContent(SYNTAX_ERROR);
    const excerpt = box.querySelector("pre");
    expect(excerpt).not.toBeNull();
    expect(excerpt!.textContent).toBe(EXCERPT);
    expect(state.track).not.toHaveBeenCalled();
  });

  it("shows a clean picker when the dialog is reopened", async () => {
    render(<ImportPipeline />);
    openDialog();
    pick(yamlFile());
    await screen.findByRole("status");
    expect(screen.queryByText("Drop a file here, or")).not.toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    openDialog();

    expect(screen.getByText("Drop a file here, or")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the dialog open and the file tab selected while the import is pending", async () => {
    let resolveImport!: (value: unknown) => void;
    state.importPipelineFromYaml.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );
    render(<ImportPipeline />);
    openDialog();
    pick(yamlFile());
    await waitFor(() =>
      expect(state.importPipelineFromYaml).toHaveBeenCalled(),
    );

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Paste YAML" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Import from File" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Reading pipeline.yaml…")).toBeInTheDocument();

    resolveImport({
      name: "My pipeline",
      overwritten: false,
      successful: true,
    });
    await screen.findByRole("status");

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
