import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentSpec, InputSpec } from "@/utils/componentSpec";

import { InputValueEditor } from "./InputValueEditor";

// Mock all the dependencies
const mockSetComponentSpec = vi.fn();
const mockTransferSelection = vi.fn();
const mockNotify = vi.fn();
const mockClearContent = vi.fn();

vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: vi.fn((ref) =>
    Promise.resolve({
      ...ref,
      spec: ref.spec || { inputs: [], outputs: [] },
      text: ref.text || "",
      digest: ref.digest || "mock-digest",
      name: ref.name || "mock-component",
    }),
  ),
}));

vi.mock("@/providers/ComponentSpecProvider", () => ({
  useComponentSpec: () => ({
    componentSpec: {
      inputs: [
        { name: "TestInput", type: "String" },
        { name: "ExistingInput", type: "String" },
      ],
      implementation: {
        container: {
          image: "test-image",
        },
      },
    },
    currentSubgraphSpec: {
      inputs: [
        { name: "TestInput", type: "String" },
        { name: "ExistingInput", type: "String" },
      ],
      implementation: {
        container: {
          image: "test-image",
        },
      },
    },
    currentSubgraphPath: ["root"],
    setComponentSpec: mockSetComponentSpec,
  }),
  ComponentSpecProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/providers/ContextPanelProvider", () => ({
  useContextPanel: () => ({
    content: null,
    setContent: vi.fn(),
    clearContent: mockClearContent,
  }),
}));

vi.mock("@/hooks/useNodeSelectionTransfer", () => ({
  useNodeSelectionTransfer: () => ({
    transferSelection: mockTransferSelection,
  }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => mockNotify,
}));

vi.mock("@/utils/inputConnectionUtils", () => ({
  checkInputConnectionToRequiredFields: () => ({
    isConnectedToRequired: false,
    connectedFields: [],
  }),
}));

vi.mock("@/utils/componentSpecValidation", () => ({
  checkNameCollision: (
    newName: string,
    currentName: string,
    _: ComponentSpec,
    type: string,
  ) => {
    if (
      type === "inputs" &&
      newName === "ExistingInput" &&
      newName !== currentName
    ) {
      return true;
    }
    return false;
  },
}));

describe("InputValueEditor", () => {
  const mockInput: InputSpec = {
    name: "TestInput",
    type: "String",
    description: "A test input",
    default: "default value",
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithQueryClient = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    );
  };

  it("displays input description in field", () => {
    renderWithQueryClient(<InputValueEditor input={mockInput} />);

    const descriptionInput = screen.getByLabelText(
      "Description",
    ) as HTMLTextAreaElement;
    expect(descriptionInput.value).toBe("A test input");
  });

  it("calls onChange when input value changes", () => {
    renderWithQueryClient(<InputValueEditor input={mockInput} />);

    const valueInput = screen.getByLabelText("Value") as HTMLTextAreaElement;
    fireEvent.change(valueInput, { target: { value: "new value" } });
    fireEvent.blur(valueInput);

    // Verify that the component spec was updated
    expect(mockSetComponentSpec).toHaveBeenCalled();
  });

  it("calls onNameChange when input name changes", () => {
    renderWithQueryClient(<InputValueEditor input={mockInput} />);
    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "NewName" } });
    fireEvent.blur(nameInput);

    // Verify that the component spec was updated and selection was transferred
    expect(mockSetComponentSpec).toHaveBeenCalled();
    expect(mockTransferSelection).toHaveBeenCalledWith("TestInput", "NewName");
  });

  it("shows validation error when renaming to existing input name", () => {
    renderWithQueryClient(<InputValueEditor input={mockInput} />);

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "ExistingInput" } });

    // Should show error message
    expect(
      screen.getByText("An input with this name already exists"),
    ).toBeInTheDocument();

    // Input should have red border
    expect(nameInput.className).toContain("border-red-500");
  });

  it("clears validation error when renaming to unique name", () => {
    renderWithQueryClient(<InputValueEditor input={mockInput} />);

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;

    // First, create a collision
    fireEvent.change(nameInput, { target: { value: "ExistingInput" } });
    expect(
      screen.getByText("An input with this name already exists"),
    ).toBeInTheDocument();

    // Then, change to unique name
    fireEvent.change(nameInput, { target: { value: "UniqueName" } });
    expect(
      screen.queryByText("An input with this name already exists"),
    ).toBeNull();
    expect(nameInput.className).not.toContain("border-red-500");
  });

  it("shows placeholder when no default value", () => {
    const inputWithoutDefault: InputSpec = {
      name: "NoDefaultInput",
      type: "String",
    };

    renderWithQueryClient(<InputValueEditor input={inputWithoutDefault} />);

    const valueInput = screen.getByLabelText("Value") as HTMLInputElement;
    expect(valueInput.getAttribute("placeholder")).toBe(
      "Enter NoDefaultInput...",
    );
  });

  it("shows default value as placeholder when available", () => {
    renderWithQueryClient(<InputValueEditor input={mockInput} />);

    const valueInput = screen.getByLabelText("Value") as HTMLInputElement;
    expect(valueInput.getAttribute("placeholder")).toBe("default value");
  });
});
