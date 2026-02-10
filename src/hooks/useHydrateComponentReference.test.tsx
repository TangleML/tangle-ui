import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hydrateComponentReference } from "@/services/componentService";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import * as yamlUtils from "@/utils/yaml";

import {
  useGuaranteedHydrateComponentReference,
  useHydrateComponentReference,
} from "./useHydrateComponentReference";

vi.mock("@/services/componentService");
vi.mock("@/utils/yaml", async () => {
  const actual = await vi.importActual<typeof yamlUtils>("@/utils/yaml");
  return {
    ...actual,
    componentSpecToText: vi.fn(),
  };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
};

describe("useHydrateComponentReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations
    vi.mocked(hydrateComponentReference).mockReset();
    vi.mocked(yamlUtils.componentSpecToText).mockReset();
  });

  it("should hydrate component with digest", async () => {
    const mockComponent: ComponentReference = {
      digest: "test-digest-123",
      spec: {
        name: "Test Component",
        implementation: {
          container: {
            image: "test-image:latest",
          },
        },
      },
    };

    const mockHydratedRef: HydratedComponentReference = {
      digest: "test-digest-123",
      name: "Test Component",
      url: "https://example.com/component.yaml",
      spec: mockComponent.spec!,
      text: "name: Test Component\nimplementation:\n  container:\n    image: test-image:latest",
    };

    vi.mocked(hydrateComponentReference).mockResolvedValue(mockHydratedRef);

    const { result } = renderHook(
      () => useHydrateComponentReference(mockComponent),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current).toEqual(mockHydratedRef);
    });

    expect(hydrateComponentReference).toHaveBeenCalledWith(mockComponent);
    // When digest is present, componentSpecToText should NOT be called
    expect(yamlUtils.componentSpecToText).not.toHaveBeenCalled();
  });

  it("should hydrate component with URL", async () => {
    const mockComponent: ComponentReference = {
      url: "https://example.com/component.yaml",
      spec: {
        name: "Test Component",
        implementation: {
          container: {
            image: "test-image:latest",
          },
        },
      },
    };

    const mockHydratedRef: HydratedComponentReference = {
      digest: "computed-digest",
      name: "Test Component",
      url: "https://example.com/component.yaml",
      spec: mockComponent.spec!,
      text: "name: Test Component\nimplementation:\n  container:\n    image: test-image:latest",
    };

    vi.mocked(hydrateComponentReference).mockResolvedValue(mockHydratedRef);

    const { result } = renderHook(
      () => useHydrateComponentReference(mockComponent),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current).toEqual(mockHydratedRef);
    });

    // When URL is present, componentSpecToText should NOT be called
    expect(yamlUtils.componentSpecToText).not.toHaveBeenCalled();
  });

  it("should hydrate component with inline spec only", async () => {
    const mockComponent: ComponentReference = {
      spec: {
        name: "Inline Component",
        description: "Component with only inline spec",
        implementation: {
          container: {
            image: "test-image:latest",
            command: ["python", "script.py"],
          },
        },
      },
    };

    // Mock componentSpecToText to return a predictable string
    vi.mocked(yamlUtils.componentSpecToText).mockReturnValue(
      "inline-component-yaml",
    );

    const mockHydratedRef: HydratedComponentReference = {
      digest: "generated-digest",
      name: "Inline Component",
      spec: mockComponent.spec!,
      text: "inline-component-yaml",
    };

    vi.mocked(hydrateComponentReference).mockResolvedValue(mockHydratedRef);

    const { result } = renderHook(
      () => useHydrateComponentReference(mockComponent),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current).toEqual(mockHydratedRef);
    });

    // Should have called componentSpecToText for inline spec
    expect(yamlUtils.componentSpecToText).toHaveBeenCalledWith(
      mockComponent.spec,
    );
  });

  it("should use different cache keys for different inline specs", async () => {
    const component1: ComponentReference = {
      spec: {
        name: "Component A",
        description: "First component",
        implementation: {
          container: {
            image: "component-a:latest",
          },
        },
      },
    };

    const component2: ComponentReference = {
      spec: {
        name: "Component B",
        description: "Second component",
        implementation: {
          container: {
            image: "component-b:latest",
          },
        },
      },
    };

    // Mock componentSpecToText to return DIFFERENT strings for different specs
    vi.mocked(yamlUtils.componentSpecToText).mockImplementation((spec) => {
      if (spec.name === "Component A") {
        return "component-a-yaml";
      } else if (spec.name === "Component B") {
        return "component-b-yaml";
      }
      return "unknown-yaml";
    });

    const hydratedRef1: HydratedComponentReference = {
      digest: "digest-a",
      name: "Component A",
      spec: component1.spec!,
      text: "component-a-yaml",
    };

    const hydratedRef2: HydratedComponentReference = {
      digest: "digest-b",
      name: "Component B",
      spec: component2.spec!,
      text: "component-b-yaml",
    };

    vi.mocked(hydrateComponentReference).mockImplementation(async (ref) => {
      if (ref.spec?.name === "Component A") {
        return hydratedRef1;
      } else if (ref.spec?.name === "Component B") {
        return hydratedRef2;
      }
      return null;
    });

    const wrapper = createWrapper();

    const { result: result1 } = renderHook(
      () => useHydrateComponentReference(component1),
      { wrapper },
    );

    const { result: result2 } = renderHook(
      () => useHydrateComponentReference(component2),
      { wrapper },
    );

    await waitFor(() => {
      expect(result1.current).toEqual(hydratedRef1);
      expect(result2.current).toEqual(hydratedRef2);
    });

    // Verify that hydrateComponentReference was called twice (different cache keys)
    expect(hydrateComponentReference).toHaveBeenCalledTimes(2);
  });

  it("should use same cache key for identical inline specs", async () => {
    const component1: ComponentReference = {
      spec: {
        name: "Same Component",
        description: "Identical spec",
        implementation: {
          container: {
            image: "same-image:latest",
          },
        },
      },
    };

    const component2: ComponentReference = {
      spec: {
        name: "Same Component",
        description: "Identical spec",
        implementation: {
          container: {
            image: "same-image:latest",
          },
        },
      },
    };

    // Mock componentSpecToText to return SAME string for identical specs
    vi.mocked(yamlUtils.componentSpecToText).mockReturnValue(
      "identical-yaml-string",
    );

    const hydratedRef: HydratedComponentReference = {
      digest: "digest-same",
      name: "Same Component",
      spec: component1.spec!,
      text: "identical-yaml-string",
    };

    vi.mocked(hydrateComponentReference).mockResolvedValue(hydratedRef);

    const wrapper = createWrapper();

    const { result: result1 } = renderHook(
      () => useHydrateComponentReference(component1),
      { wrapper },
    );

    const { result: result2 } = renderHook(
      () => useHydrateComponentReference(component2),
      { wrapper },
    );

    await waitFor(() => {
      expect(result1.current).toEqual(hydratedRef);
      expect(result2.current).toEqual(hydratedRef);
    });

    // Should only call hydration once (same cache key)
    expect(hydrateComponentReference).toHaveBeenCalledTimes(1);
    // componentSpecToText might be called twice (once per hook call), but the result is the same
    expect(yamlUtils.componentSpecToText).toHaveBeenCalled();
  });

  it("should handle component with text field", async () => {
    const mockComponent: ComponentReference = {
      text: "name: Text Component\nimplementation:\n  container:\n    image: text-image:latest",
    };

    const mockHydratedRef: HydratedComponentReference = {
      digest: "digest-from-text",
      name: "Text Component",
      spec: {
        name: "Text Component",
        implementation: {
          container: {
            image: "text-image:latest",
          },
        },
      },
      text: mockComponent.text!,
    };

    vi.mocked(hydrateComponentReference).mockResolvedValue(mockHydratedRef);

    const { result } = renderHook(
      () => useHydrateComponentReference(mockComponent),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current).toEqual(mockHydratedRef);
    });

    // Should NOT call componentSpecToText when text is present
    expect(yamlUtils.componentSpecToText).not.toHaveBeenCalled();
  });
});

describe("useGuaranteedHydrateComponentReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hydrateComponentReference).mockReset();
  });

  it("should return hydrated component when successful", async () => {
    const mockComponent: ComponentReference = {
      digest: "test-digest",
      spec: {
        name: "Test Component",
        implementation: {
          container: {
            image: "test-image:latest",
          },
        },
      },
    };

    const mockHydratedRef: HydratedComponentReference = {
      digest: "test-digest",
      name: "Test Component",
      spec: mockComponent.spec!,
      text: "name: Test Component\nimplementation:\n  container:\n    image: test-image:latest",
    };

    vi.mocked(hydrateComponentReference).mockResolvedValue(mockHydratedRef);

    const { result } = renderHook(
      () => useGuaranteedHydrateComponentReference(mockComponent),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current).toEqual(mockHydratedRef);
    });
  });
});
