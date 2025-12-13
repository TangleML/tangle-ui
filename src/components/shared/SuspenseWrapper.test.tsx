import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SuspenseWrapper, withSuspenseWrapper } from "./SuspenseWrapper";

// Helper component that can trigger suspense
const SuspendingComponent = ({ shouldSuspend }: { shouldSuspend: boolean }) => {
  if (shouldSuspend) {
    throw new Promise(() => {});
  }
  return <div data-testid="loaded-content">Content Loaded</div>;
};

// Helper component that throws an error
const ErrorComponent = ({ shouldError }: { shouldError: boolean }) => {
  if (shouldError) {
    throw new Error("Test error");
  }
  return <div data-testid="success-content">Success</div>;
};

describe("<SuspenseWrapper />", () => {
  test("renders children when not suspended", () => {
    render(
      <SuspenseWrapper>
        <div data-testid="test-child">Child Content</div>
      </SuspenseWrapper>,
    );

    expect(screen.getByTestId("test-child")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  test("shows default fallback when loading", () => {
    render(
      <SuspenseWrapper>
        <SuspendingComponent shouldSuspend={true} />
      </SuspenseWrapper>,
    );

    // Should show default loading state with spinner and skeleton
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("loaded-content")).not.toBeInTheDocument();
  });

  test("shows custom fallback when provided", () => {
    const customFallback = (
      <div data-testid="custom-fallback">Custom Loading...</div>
    );

    render(
      <SuspenseWrapper fallback={customFallback}>
        <SuspendingComponent shouldSuspend={true} />
      </SuspenseWrapper>,
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.getByText("Custom Loading...")).toBeInTheDocument();
    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
  });

  describe("when an error is thrown", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("shows error fallback when error is thrown", () => {
      render(
        <SuspenseWrapper>
          <ErrorComponent shouldError={true} />
        </SuspenseWrapper>,
      );

      // Should show error message and retry button
      const errorButton = screen.getByRole("button", {
        name: "A UI element failed to render. Click to retry.",
      });
      expect(errorButton).toBeInTheDocument();
      expect(screen.queryByTestId("success-content")).not.toBeInTheDocument();
    });

    test("resets error when Try again button is clicked", async () => {
      let shouldError = true;

      const TestComponent = () => {
        if (shouldError) {
          throw new Error("Test error");
        }
        return <div data-testid="recovered-content">Recovered</div>;
      };

      render(
        <SuspenseWrapper>
          <TestComponent />
        </SuspenseWrapper>,
      );

      // Initially shows error
      const retryButton = screen.getByRole("button", {
        name: "A UI element failed to render. Click to retry.",
      });
      expect(retryButton).toBeInTheDocument();

      // Fix the error condition and click retry
      shouldError = false;
      fireEvent.click(retryButton);

      // Should recover and show content
      await waitFor(() => {
        expect(screen.getByTestId("recovered-content")).toBeInTheDocument();
      });
      expect(screen.getByText("Recovered")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: "A UI element failed to render. Click to retry.",
        }),
      ).not.toBeInTheDocument();
    });

    test("shows custom errorFallback when provided", () => {
      const customErrorFallback = ({ error, resetErrorBoundary }: any) => (
        <div data-testid="custom-error-fallback">
          <h2>Custom Error Handler</h2>
          <p>Error: {error?.message || "Unknown error"}</p>
          <button onClick={resetErrorBoundary} data-testid="custom-retry">
            Custom Retry
          </button>
        </div>
      );

      render(
        <SuspenseWrapper errorFallback={customErrorFallback}>
          <ErrorComponent shouldError={true} />
        </SuspenseWrapper>,
      );

      // Should show custom error fallback instead of default
      expect(screen.getByTestId("custom-error-fallback")).toBeInTheDocument();
      expect(screen.getByText("Custom Error Handler")).toBeInTheDocument();
      expect(screen.getByText("Error: Test error")).toBeInTheDocument();
      expect(screen.getByTestId("custom-retry")).toBeInTheDocument();

      // Should NOT show default error UI
      expect(
        screen.queryByRole("button", {
          name: "A UI element failed to render. Click to retry.",
        }),
      ).not.toBeInTheDocument();
    });

    test("custom errorFallback can reset errors", async () => {
      let shouldError = true;
      const retryHandler = vi.fn();

      const customErrorFallback = ({ resetErrorBoundary }: any) => (
        <div data-testid="custom-error">
          <h3>Something went wrong</h3>
          <button
            onClick={() => {
              retryHandler();
              resetErrorBoundary();
            }}
            data-testid="custom-reset"
          >
            Reset
          </button>
        </div>
      );

      const TestComponent = () => {
        if (shouldError) {
          throw new Error("Controlled error");
        }
        return <div data-testid="success-state">All good!</div>;
      };

      render(
        <SuspenseWrapper errorFallback={customErrorFallback}>
          <TestComponent />
        </SuspenseWrapper>,
      );

      // Initially shows custom error
      expect(screen.getByTestId("custom-error")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Fix the error condition and click custom reset
      shouldError = false;
      fireEvent.click(screen.getByTestId("custom-reset"));

      // Verify retry handler was called
      expect(retryHandler).toHaveBeenCalledTimes(1);

      // Should recover and show success state
      await waitFor(() => {
        expect(screen.getByTestId("success-state")).toBeInTheDocument();
      });
      expect(screen.getByText("All good!")).toBeInTheDocument();
      expect(screen.queryByTestId("custom-error")).not.toBeInTheDocument();
    });
  });

  test("transitions from loading to loaded state", async () => {
    let resolveSuspense: () => void;
    const suspensePromise = new Promise<void>((resolve) => {
      resolveSuspense = resolve;
    });

    // Mock component that uses React's use() hook pattern
    let isResolved = false;
    const TestAsyncComponent = () => {
      if (!isResolved) {
        throw suspensePromise;
      }
      return <div data-testid="async-content">Async Loaded</div>;
    };

    render(
      <SuspenseWrapper>
        <TestAsyncComponent />
      </SuspenseWrapper>,
    );

    // Initially shows loading
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("async-content")).not.toBeInTheDocument();

    // Resolve the promise
    await act(async () => {
      isResolved = true;
      resolveSuspense!();
      await suspensePromise;
    });

    // Should show loaded content
    await waitFor(() => {
      expect(screen.getByTestId("async-content")).toBeInTheDocument();
    });
    expect(screen.getByText("Async Loaded")).toBeInTheDocument();
    expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
  });
});

describe("withSuspenseWrapper()", () => {
  test("wraps component and renders it correctly", () => {
    const TestComponent = ({ message }: { message: string }) => (
      <div data-testid="wrapped-component">{message}</div>
    );
    TestComponent.displayName = "TestComponent";

    const WrappedComponent = withSuspenseWrapper(TestComponent);

    render(<WrappedComponent message="Hello World" />);

    expect(screen.getByTestId("wrapped-component")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  test("passes all props through to wrapped component", async () => {
    interface TestProps {
      id: string;
      count: number;
      isActive: boolean;
      onClick: () => void;
    }

    const TestComponent = ({ id, count, isActive, onClick }: TestProps) => (
      <div data-testid={id} onClick={onClick}>
        Count: {count}, Active: {isActive.toString()}
      </div>
    );

    const WrappedComponent = withSuspenseWrapper(TestComponent);
    const handleClick = vi.fn();

    render(
      <WrappedComponent
        id="test-id"
        count={42}
        isActive={true}
        onClick={handleClick}
      />,
    );

    const element = screen.getByTestId("test-id");
    expect(element).toBeInTheDocument();
    expect(screen.getByText("Count: 42, Active: true")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(element);
    });

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("uses provided Skeleton component as fallback", () => {
    const CustomSkeleton = () => (
      <div data-testid="custom-skeleton">Custom Skeleton Loading</div>
    );

    const TestComponent = () => {
      // This will suspend indefinitely
      throw new Promise(() => {});
    };

    const WrappedComponent = withSuspenseWrapper(TestComponent, CustomSkeleton);

    render(<WrappedComponent />);

    expect(screen.getByTestId("custom-skeleton")).toBeInTheDocument();
    expect(screen.getByText("Custom Skeleton Loading")).toBeInTheDocument();
  });

  test("uses default fallback when no Skeleton is provided", () => {
    const TestComponent = () => {
      // This will suspend indefinitely
      throw new Promise(() => {});
    };

    const WrappedComponent = withSuspenseWrapper(TestComponent);

    render(<WrappedComponent />);

    // Should show default loading state
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  test("sets correct displayName for wrapped component", () => {
    const NamedComponent = () => <div>Named</div>;
    NamedComponent.displayName = "MyNamedComponent";

    const AnonymousComponent = () => <div>Anonymous</div>;

    const UnnamedComponent = () => <div>Unnamed</div>;
    UnnamedComponent.displayName = "";

    const FallbackComponent = () => <div>Fallback</div>;
    // No displayName property at all

    const WrappedNamed = withSuspenseWrapper(NamedComponent);
    const WrappedAnonymous = withSuspenseWrapper(AnonymousComponent);
    const WrappedUnnamed = withSuspenseWrapper(UnnamedComponent);
    const WrappedFallback = withSuspenseWrapper(FallbackComponent);

    expect(WrappedNamed.displayName).toBe("SuspenseWrapper(MyNamedComponent)");
    expect(WrappedAnonymous.displayName).toBe(
      "SuspenseWrapper(AnonymousComponent)",
    );
    // Empty string displayName results in "SuspenseWrapper()"
    expect(WrappedUnnamed.displayName).toBe("SuspenseWrapper()");
    // When no displayName property exists, it falls back to function name or "Component"
    expect(WrappedFallback.displayName).toBe(
      "SuspenseWrapper(FallbackComponent)",
    );
  });

  describe("when an error is thrown", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test("handles errors in wrapped component", () => {
      const ErrorProneComponent = () => {
        throw new Error("Component error");
      };

      const WrappedComponent = withSuspenseWrapper(ErrorProneComponent);

      render(<WrappedComponent />);

      // Should show error UI
      const errorButton = screen.getByRole("button", {
        name: "A UI element failed to render. Click to retry.",
      });
      expect(errorButton).toBeInTheDocument();
    });

    test("wrapped component can recover from error", async () => {
      let shouldError = true;

      const RecoverableComponent = () => {
        if (shouldError) {
          throw new Error("Recoverable error");
        }
        return <div data-testid="recovered">Recovered Successfully</div>;
      };

      const WrappedComponent = withSuspenseWrapper(RecoverableComponent);

      render(<WrappedComponent />);

      // Initially shows error
      const retryButton = screen.getByRole("button", {
        name: "A UI element failed to render. Click to retry.",
      });
      expect(retryButton).toBeInTheDocument();

      // Fix error and retry
      shouldError = false;
      fireEvent.click(retryButton);

      // Should recover
      await waitFor(() => {
        expect(screen.getByTestId("recovered")).toBeInTheDocument();
      });
      expect(screen.getByText("Recovered Successfully")).toBeInTheDocument();
    });
  });
});
