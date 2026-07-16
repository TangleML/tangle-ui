import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import useToastNotification from "@/hooks/useToastNotification";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";

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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToastNotification).mockReturnValue(vi.fn());
    vi.mocked(useComponentLibrary).mockReturnValue({
      addToComponentLibrary: vi.fn(),
    } as any);
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
});
