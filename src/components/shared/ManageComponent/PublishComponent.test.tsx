import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import yaml from "js-yaml";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { HydratedComponentReference } from "@/utils/componentSpec";

import { PublishComponent } from "./PublishComponent";

// Mock the hooks
vi.mock("@/hooks/useUserDetails", () => ({
  useUserDetails: vi.fn(() => ({
    data: {
      id: "TestUser",
      permissions: ["read", "write"],
    },
  })),
}));

vi.mock("./hooks/usePublishedComponentHistory", () => ({
  usePublishedComponentHistory: vi.fn(() => ({
    data: [], // Empty history for first publish scenario
    refetch: vi.fn(),
  })),
}));

vi.mock("@/hooks/useHydrateComponentReference", () => ({
  useHydrateComponentReference: vi.fn((component) => component),
}));

vi.mock("@/providers/ComponentLibraryProvider", () => ({
  useComponentLibrary: vi.fn(() => ({
    getComponentLibrary: vi.fn(() => ({
      addComponent: vi.fn(),
    })),
  })),
}));

// Create a test wrapper with QueryClient
const TestWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("<PublishComponent />", () => {
  let mockComponent: HydratedComponentReference;

  beforeEach(() => {
    const spec = {
      name: "test-component",
      description: "Test component description",
      implementation: {
        graph: {
          tasks: {},
        },
      },
      metadata: {
        annotations: {
          author: "Test Author",
        },
      },
    };
    mockComponent = {
      name: "test-component",
      digest: "sha256:abc123def456",
      spec,
      text: yaml.dump(spec),
    };
  });

  test("should display publish button when there is no component history", async () => {
    render(
      <TestWrapper>
        <PublishComponent
          component={mockComponent}
          displayName="Test Component"
        />
      </TestWrapper>,
    );

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText("Component Review")).toBeInTheDocument();
    });

    // Check that component properties are displayed
    expect(screen.getByText("Test Author")).toBeInTheDocument();
    expect(screen.getByText("test-component")).toBeInTheDocument();
    expect(screen.getByText("Test component description")).toBeInTheDocument();
    // Using getAllByText since the digest appears in multiple places (property and tooltip)
    const digestElements = screen.getAllByText("sha256:abc123def456");
    expect(digestElements.length).toBeGreaterThan(0);
    expect(screen.getByText("TestUser")).toBeInTheDocument();

    // Check that the publish button is visible
    const publishButton = await screen.findByTestId("publish-component-button");
    expect(publishButton).toBeInTheDocument();
    expect(publishButton).toHaveTextContent("Publish component");
    expect(publishButton).not.toBeDisabled();

    // Check that the "not published yet" message is shown
    expect(
      screen.getByText(/this component has not been published yet/i),
    ).toBeInTheDocument();
  });

  test("should display the component description text", () => {
    render(
      <TestWrapper>
        <PublishComponent
          component={mockComponent}
          displayName="Test Component"
        />
      </TestWrapper>,
    );

    // Check that the description about published components is shown
    expect(
      screen.getByText(/Published Components are shared components/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/available to all users in the workspace/i),
    ).toBeInTheDocument();
  });

  test("should have the component review container", async () => {
    render(
      <TestWrapper>
        <PublishComponent
          component={mockComponent}
          displayName="Test Component"
        />
      </TestWrapper>,
    );

    // Wait for and check the component review container
    await waitFor(() => {
      const reviewContainer = screen.getByTestId("component-review-container");
      expect(reviewContainer).toBeInTheDocument();
    });
  });
});
