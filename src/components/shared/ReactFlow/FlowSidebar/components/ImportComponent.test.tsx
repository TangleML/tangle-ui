import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as yaml from "js-yaml";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { hydrateComponentReference } from "@/services/componentService";

import ImportComponent from "./ImportComponent";

vi.mock("@/hooks/useToastNotification", () => ({
  default: vi.fn(),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: vi.fn().mockReturnValue({ track: vi.fn() }),
}));

vi.mock("@/providers/ComponentLibraryProvider", () => ({
  useComponentLibrary: vi.fn(),
}));

vi.mock("@/services/componentService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/componentService")>()),
  hydrateComponentReference: vi.fn(),
}));

vi.mock("@/components/shared/ComponentEditor/ComponentEditorDialog", () => ({
  ComponentEditorDialog: ({ templateName }: { templateName?: string }) => (
    <div data-testid="component-editor-dialog">editor:{templateName}</div>
  ),
}));

describe("<ImportComponent />", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const TestWrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const renderWithProviders = (component: ReactElement) =>
    render(component, { wrapper: TestWrapper });

  const componentYaml =
    "name: my-component\nimplementation:\n  container:\n    image: alpine\n";

  const hydratedComponent = {
    name: "my-component",
    digest: "digest-1",
    text: componentYaml,
    spec: {
      name: "my-component",
      implementation: { container: { image: "alpine" } },
    },
  };

  const notify = vi.fn();
  const track = vi.fn();
  const addToComponentLibrary = vi.fn();

  const openDialog = async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportComponent />);
    await user.click(screen.getByTestId("import-component-button"));
    await waitFor(() => {
      expect(screen.getByTestId("import-component-dialog")).toBeInTheDocument();
    });
  };

  const pickFile = (file: File) => {
    fireEvent.change(screen.getByTestId("file-picker-input"), {
      target: { files: [file] },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToastNotification).mockReturnValue(notify);
    vi.mocked(useAnalytics).mockReturnValue({ track } as any);
    addToComponentLibrary.mockImplementation(async (component) => component);
    vi.mocked(useComponentLibrary).mockReturnValue({
      addToComponentLibrary,
    } as any);
    vi.mocked(hydrateComponentReference).mockResolvedValue(
      hydratedComponent as any,
    );
  });

  test("closes the add-component modal when a template is selected so the fullscreen editor can receive focus", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportComponent />);

    await user.click(screen.getByTestId("import-component-button"));

    await waitFor(() => {
      expect(screen.getByTestId("import-component-dialog")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "New" }));

    const emptyTemplate = await screen.findByTestId(
      "new-component-template-selector-option-empty",
    );
    await user.click(emptyTemplate);

    expect(screen.getByTestId("component-editor-dialog")).toHaveTextContent(
      "editor:empty",
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("import-component-dialog"),
      ).not.toBeInTheDocument();
    });
  });

  describe("File tab", () => {
    test("imports a picked .yaml file and keeps the dialog open with a green box", async () => {
      await openDialog();

      pickFile(new File([componentYaml], "component.yaml"));

      expect(
        await screen.findByText("my-component added to your library"),
      ).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Import successful");
      expect(hydrateComponentReference).toHaveBeenCalledWith({
        text: componentYaml,
        url: undefined,
      });
      expect(addToComponentLibrary).toHaveBeenCalledWith(
        hydratedComponent,
        "import_dialog",
      );
      expect(track).toHaveBeenCalledWith(
        "pipeline_editor.add_component.import_completed",
        { method: "file" },
      );
      expect(screen.getByTestId("import-component-dialog")).toBeInTheDocument();
      expect(notify).not.toHaveBeenCalled();
    });

    test("accepts a .yml file", async () => {
      await openDialog();

      pickFile(new File([componentYaml], "component.yml"));

      expect(
        await screen.findByText("my-component added to your library"),
      ).toBeInTheDocument();
      expect(hydrateComponentReference).toHaveBeenCalledWith({
        text: componentYaml,
        url: undefined,
      });
    });

    test("rejects a .txt file with the extension reason and does not import", async () => {
      await openDialog();

      pickFile(new File([componentYaml], "component.txt"));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Import failed");
      expect(alert).toHaveTextContent(
        "component.txt isn't a .yaml or .yml file.",
      );
      expect(hydrateComponentReference).not.toHaveBeenCalled();
      expect(addToComponentLibrary).not.toHaveBeenCalled();
    });

    test("shows the hydrate error's message in a red box", async () => {
      vi.mocked(hydrateComponentReference).mockRejectedValue(
        new Error("Component text could not be fetched"),
      );
      await openDialog();

      pickFile(new File([componentYaml], "component.yaml"));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Import failed");
      expect(alert).toHaveTextContent("Component text could not be fetched");
      expect(addToComponentLibrary).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
      expect(screen.getByTestId("import-component-dialog")).toBeInTheDocument();
    });

    test("shows the YAML parse error message and excerpt in a red box", async () => {
      const invalidYaml = "{{{";
      let yamlError = "";
      try {
        yaml.load(invalidYaml);
      } catch (error) {
        yamlError = (error as Error).message;
      }
      const [yamlMessage, yamlExcerpt] = yamlError.split("\n\n");
      vi.mocked(hydrateComponentReference).mockResolvedValue(null);
      await openDialog();

      pickFile(new File([invalidYaml], "component.yaml"));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Import failed");
      expect(alert).toHaveTextContent(yamlMessage);
      expect(alert).not.toHaveTextContent("Failed to hydrate component");
      expect(alert.querySelector("pre")?.textContent).toBe(yamlExcerpt);
      expect(addToComponentLibrary).not.toHaveBeenCalled();
    });

    test("shows a red box and does not track when the component is not added", async () => {
      addToComponentLibrary.mockResolvedValue(undefined);
      await openDialog();

      pickFile(new File([componentYaml], "component.yaml"));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Import failed");
      expect(alert).toHaveTextContent("Import cancelled");
      expect(track).not.toHaveBeenCalledWith(
        "pipeline_editor.add_component.import_completed",
        expect.anything(),
      );
      expect(notify).not.toHaveBeenCalled();
    });

    test("shows a clean picker when the dialog is reopened after a success", async () => {
      const user = userEvent.setup();
      await openDialog();

      pickFile(new File([componentYaml], "component.yaml"));
      expect(
        await screen.findByText("my-component added to your library"),
      ).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(
          screen.queryByTestId("import-component-dialog"),
        ).not.toBeInTheDocument();
      });

      await user.click(screen.getByTestId("import-component-button"));
      await waitFor(() => {
        expect(
          screen.getByTestId("import-component-dialog"),
        ).toBeInTheDocument();
      });

      expect(screen.getByTestId("file-picker-input")).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(
        screen.queryByText("my-component added to your library"),
      ).not.toBeInTheDocument();
    });
  });
});
