import { fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { checkFile, YAML_FILE_ACCEPT } from "./fileChecks";
import { FilePicker, type FilePickerProps } from "./FilePicker";
import { type PickOutcome, useFilePicker } from "./useFilePicker";

const LABEL = "Pipeline YAML file";

const goToPipeline = vi.fn();

const imported: PickOutcome = {
  status: "success",
  message: "Imported pipeline.yaml",
  actions: [{ label: "Go to Pipeline", onSelect: goToPipeline }],
};

type PickerOverrides = Pick<
  FilePickerProps,
  | "accept"
  | "maxBytes"
  | "disabled"
  | "afterSuccess"
  | "dropZone"
  | "statusDismissible"
  | "onBrowse"
>;

function renderPicker(props: PickerOverrides = {}) {
  const onFile = vi.fn(() => imported);
  render(
    <FilePicker
      accept={YAML_FILE_ACCEPT}
      label={LABEL}
      {...props}
      onFile={onFile}
    />,
  );
  return onFile;
}

function HostOwnedPicker({ onFile }: { onFile: () => PickOutcome }) {
  const picker = useFilePicker({ onFile, accept: YAML_FILE_ACCEPT });
  return <FilePicker picker={picker} accept={YAML_FILE_ACCEPT} label={LABEL} />;
}

function ConfiguredHostPicker({
  pickerDisabled = false,
  ...viewProps
}: PickerOverrides & {
  pickerDisabled?: boolean;
  browse?: boolean;
}) {
  const picker = useFilePicker({
    onFile: () => imported,
    accept: YAML_FILE_ACCEPT,
    disabled: pickerDisabled,
  });
  return (
    <>
      <FilePicker picker={picker} label={LABEL} {...viewProps} />
      <button type="button" onClick={picker.openBrowse}>
        Host browse
      </button>
    </>
  );
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const yamlFile = () => new File(["name: Pipeline"], "pipeline.yaml");
const textFile = () => new File(["hello"], "notes.txt");

function fileDrag(...files: File[]) {
  return { dataTransfer: { files, types: ["Files"], dropEffect: "none" } };
}

const input = () => screen.getByTestId("file-picker-input");
const prompt = () => screen.getByText("Drop a file here, or");
const zone = () =>
  screen
    .getByRole("region", { name: LABEL })
    .querySelector<HTMLElement>(".border-dashed")!;
const browseButton = () => screen.getByRole("button", { name: "browse" });

function pick(file: File) {
  fireEvent.change(input(), { target: { files: [file] } });
}

let clickSpy: MockInstance<() => void>;

beforeEach(() => {
  clickSpy = vi
    .spyOn(HTMLInputElement.prototype, "click")
    .mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  goToPipeline.mockReset();
});

describe("FilePicker", () => {
  it("renders the prompt, the derived hint, the labelled region and the input", () => {
    renderPicker();

    expect(screen.getByRole("region", { name: LABEL })).toBeInTheDocument();
    expect(prompt()).toBeInTheDocument();
    expect(
      screen.getByText("Accepts .yaml, .yml · up to 5 MB"),
    ).toBeInTheDocument();
    expect(input()).toHaveAttribute("type", "file");
    expect(input()).toHaveAttribute("accept", ".yaml,.yml");
    expect(input()).toHaveAccessibleName(LABEL);
  });

  it("omits the part of the hint that does not apply", () => {
    renderPicker({ accept: "any", maxBytes: 1024 * 1024 });

    expect(screen.getByText("up to 1 MB")).toBeInTheDocument();
  });

  it("opens the file dialog once from the browse button", () => {
    renderPicker();

    fireEvent.click(browseButton());

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("opens the file dialog from a click on the zone", () => {
    renderPicker();

    fireEvent.click(zone());

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("calls onBrowse once before opening the file dialog from the browse button and the zone", () => {
    const onBrowse = vi.fn();
    renderPicker({ onBrowse });

    fireEvent.click(browseButton());

    expect(onBrowse).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(onBrowse.mock.invocationCallOrder[0]).toBeLessThan(
      clickSpy.mock.invocationCallOrder[0],
    );

    clickSpy.mockClear();
    onBrowse.mockClear();
    fireEvent.click(zone());

    expect(onBrowse).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(onBrowse.mock.invocationCallOrder[0]).toBeLessThan(
      clickSpy.mock.invocationCallOrder[0],
    );
  });

  it("hands a browsed YAML file to onFile and shows the success box with its action", async () => {
    const onFile = renderPicker();

    pick(yamlFile());

    const box = await screen.findByRole("status");
    expect(onFile).toHaveBeenCalledWith(
      expect.objectContaining({ text: "name: Pipeline", source: "browse" }),
    );
    expect(box).toHaveAttribute("aria-live", "polite");
    expect(box).toHaveTextContent("Import successful");
    expect(box).toHaveTextContent("Imported pipeline.yaml");

    fireEvent.click(screen.getByRole("button", { name: "Go to Pipeline" }));
    expect(goToPipeline).toHaveBeenCalledTimes(1);
  });

  it("replaces the zone with the success box by default", async () => {
    renderPicker();

    pick(yamlFile());

    await screen.findByRole("status");
    expect(screen.queryByText("Drop a file here, or")).not.toBeInTheDocument();
  });

  it("keeps the zone next to the success box with keep-picker", async () => {
    renderPicker({ afterSuccess: "keep-picker" });

    pick(yamlFile());

    await screen.findByRole("status");
    expect(prompt()).toBeInTheDocument();
  });

  it("shows the file check's own message in the error box for a rejected file", async () => {
    const onFile = renderPicker();
    const file = textFile();
    const expected = checkFile(file, {
      accept: YAML_FILE_ACCEPT,
      maxBytes: null,
      requireText: true,
    });

    pick(file);

    const box = await screen.findByRole("alert");
    expect(expected?.message).toBe("notes.txt isn't a .yaml or .yml file.");
    expect(box).toHaveTextContent("Import failed");
    expect(box).toHaveTextContent("notes.txt isn't a .yaml or .yml file.");
    expect(onFile).not.toHaveBeenCalled();
    expect(prompt()).toBeInTheDocument();
  });

  it("dismisses the status box with its ✕", async () => {
    renderPicker();

    pick(textFile());
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(prompt()).toBeInTheDocument();
  });

  it("restores the zone when the replacing success box is dismissed, even with statusDismissible off", async () => {
    renderPicker({ statusDismissible: false });

    pick(yamlFile());
    await screen.findByRole("status");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(prompt()).toBeInTheDocument();
  });

  it("shows no ✕ on the error box or the keep-picker success box with statusDismissible off", async () => {
    renderPicker({ statusDismissible: false, afterSuccess: "keep-picker" });

    pick(textFile());
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Dismiss" }),
    ).not.toBeInTheDocument();

    pick(yamlFile());
    await screen.findByRole("status");
    expect(
      screen.queryByRole("button", { name: "Dismiss" }),
    ).not.toBeInTheDocument();
  });

  it("renders an error detail in a pre block", async () => {
    render(
      <FilePicker
        accept={YAML_FILE_ACCEPT}
        label={LABEL}
        onFile={() => ({
          status: "error",
          message: "Could not parse pipeline.yaml",
          detail: "line 3: unexpected indent",
        })}
      />,
    );

    pick(yamlFile());

    const box = await screen.findByRole("alert");
    const detail = box.querySelector("pre");
    expect(detail).toHaveTextContent("line 3: unexpected indent");
  });

  it("highlights the zone while a file is dragged over and hands the dropped file to onFile", async () => {
    const onFile = renderPicker();

    fireEvent.dragEnter(zone(), fileDrag());

    expect(screen.getByText("Drop to use this file")).toBeInTheDocument();
    expect(zone()).toHaveClass("border-primary");

    fireEvent.drop(zone(), fileDrag(yamlFile()));

    await screen.findByRole("status");
    expect(onFile).toHaveBeenCalledWith(
      expect.objectContaining({ source: "drop" }),
    );
  });

  it("ignores a drop and a click while disabled", async () => {
    const onFile = renderPicker({ disabled: true });

    fireEvent.dragEnter(zone(), fileDrag());
    expect(screen.queryByText("Drop to use this file")).not.toBeInTheDocument();
    fireEvent.drop(zone(), fileDrag(yamlFile()));
    fireEvent.click(zone());
    fireEvent.click(browseButton());

    await settle();
    expect(onFile).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    expect(browseButton()).toBeDisabled();
  });

  it("renders no drop target and a plain browse button without a drop zone", async () => {
    const onFile = renderPicker({ dropZone: false });

    expect(screen.queryByText("Drop a file here, or")).not.toBeInTheDocument();
    const region = screen.getByRole("region", { name: LABEL });
    expect(region.querySelector(".border-dashed")).toBeNull();
    fireEvent.dragEnter(region, fileDrag());
    fireEvent.drop(region, fileDrag(yamlFile()));

    fireEvent.click(browseButton());

    await settle();
    expect(onFile).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("does not spread the drop target props of an external picker", async () => {
    const onFile = vi.fn(() => imported);
    render(<HostOwnedPicker onFile={onFile} />);

    fireEvent.dragEnter(zone(), fileDrag());
    expect(screen.queryByText("Drop to use this file")).not.toBeInTheDocument();
    fireEvent.drop(zone(), fileDrag(yamlFile()));

    await settle();
    expect(onFile).not.toHaveBeenCalled();

    pick(yamlFile());
    await screen.findByRole("status");
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it("derives the hint of an external picker from the accept and maxBytes passed alongside", () => {
    render(
      <ConfiguredHostPicker accept={YAML_FILE_ACCEPT} maxBytes={1024 * 1024} />,
    );

    expect(
      screen.getByText("Accepts .yaml, .yml · up to 1 MB"),
    ).toBeInTheDocument();
  });

  it("honours the disabled state of an external picker", () => {
    render(<ConfiguredHostPicker pickerDisabled />);

    fireEvent.click(zone());

    expect(browseButton()).toBeDisabled();
    expect(zone()).toHaveClass("opacity-50");
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("keeps the hidden input so a host can open the file dialog with neither browse nor a drop zone", () => {
    render(<ConfiguredHostPicker browse={false} dropZone={false} />);

    expect(screen.queryByRole("button", { name: "browse" })).toBeNull();
    expect(input()).toHaveClass("sr-only");

    fireEvent.click(screen.getByRole("button", { name: "Host browse" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy.mock.contexts[0]).toBe(input());
  });

  it("uses the label as the accessible name of both the region and the input", () => {
    render(<ConfiguredHostPicker />);

    expect(screen.getByRole("region", { name: LABEL })).toBeInTheDocument();
    expect(input()).toHaveAccessibleName(LABEL);
  });
});
