import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { useAwaitAuthorization } from "../useAwaitAuthorization";

vi.mock("../useAuthLocalStorage", () => ({
  useAuthLocalStorage: vi.fn(),
}));

vi.mock("@/components/shared/GitHubAuth/useGitHubAuthPopup", () => ({
  useGitHubAuthPopup: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: vi.fn(),
}));

describe("useAwaitAuthorization()", () => {
  let mockUseAuthLocalStorage: Mock;
  let mockUseGitHubAuthPopup: Mock;
  let mockNotify: Mock;

  let mockAuthStorage: {
    subscribe: Mock;
    getToken: Mock;
    getJWT: Mock;
    setJWT: Mock;
    clear: Mock;
  };

  let mockPopupHandlers: {
    openPopup: Mock;
    closePopup: Mock;
    bringPopupToFront: Mock;
    isLoading: boolean;
    isPopupOpen: boolean;
  };

  const wrapper = ({ children }: PropsWithChildren) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    vi.stubEnv("VITE_REQUIRE_AUTHORIZATION", "true");

    vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("VITE_HUGGING_FACE_AUTHORIZATION", undefined);

    // Mock notification
    mockNotify = vi.fn();
    const mockUseToastNotification = vi.mocked(
      (await import("@/hooks/useToastNotification")).default,
    );
    mockUseToastNotification.mockReturnValue(mockNotify);

    // Mock auth storage
    mockAuthStorage = {
      subscribe: vi.fn(),
      getToken: vi.fn(),
      getJWT: vi.fn(),
      setJWT: vi.fn(),
      clear: vi.fn(),
    };

    mockUseAuthLocalStorage = vi.mocked(
      (await import("../useAuthLocalStorage")).useAuthLocalStorage,
    );
    mockUseAuthLocalStorage.mockReturnValue(mockAuthStorage);

    // Mock popup handlers
    mockPopupHandlers = {
      openPopup: vi.fn(),
      closePopup: vi.fn(),
      bringPopupToFront: vi.fn(),
      isLoading: false,
      isPopupOpen: false,
    };

    mockUseGitHubAuthPopup = vi.mocked(
      (await import("@/components/shared/GitHubAuth/useGitHubAuthPopup"))
        .useGitHubAuthPopup,
    );
    mockUseGitHubAuthPopup.mockReturnValue(mockPopupHandlers);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Initial state", () => {
    it("should return correct initial state when not authorized", () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      expect(result.current.isAuthorized).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPopupOpen).toBe(false);
    });

    it("should return correct initial state when authorized with token", () => {
      mockAuthStorage.getToken.mockReturnValue("bearer token123");
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      expect(result.current.isAuthorized).toBe(true);
    });

    it("should return correct initial state when authorization not required", () => {
      vi.stubEnv("VITE_REQUIRE_AUTHORIZATION", "false");

      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      expect(result.current.isAuthorized).toBe(true);
    });
  });

  describe("awaitAuthorization function", () => {
    it("should open popup and return promise", async () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      const promise = result.current.awaitAuthorization();

      expect(mockPopupHandlers.openPopup).toHaveBeenCalled();
      expect(promise).toBeInstanceOf(Promise);
    });

    it("should create new promise on each call", () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      const promise1 = result.current.awaitAuthorization();
      const promise2 = result.current.awaitAuthorization();

      expect(promise1).not.toBe(promise2);
      expect(mockPopupHandlers.openPopup).toHaveBeenCalledTimes(2);
    });
  });

  describe("Success flow", () => {
    it("should handle successful authorization", async () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const mockResponse = {
        token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdXRoX3Byb3ZpZGVyIjoiZ2l0aHViIiwidG9rZW5fdHlwZSI6ImJlYXJlciIsInVzZXJfaWQiOjEwMzIyOTA0OSwibG9naW4iOiJtYXh5LXNocGZ5IiwiYXZhdGFyX3VybCI6Imh0dHBzOi8vYXZhdGFycy5naXRodWJ1c2VyY29udGVudC5jb20vdS8xMDMyMjkwNDk_dj00IiwiZXhwIjoxNzUyNDc0MTgwfQ.mKQle80d7d1WhTz0DjqXDYcqvMFcQnviYdwHeCXLccc",
        tokenType: "JWT",
      };

      const expectedJWT = {
        auth_provider: "github",
        avatar_url: "https://avatars.githubusercontent.com/u/103229049?v=4",
        exp: 1752474180,
        login: "maxy-shpfy",
        original_token: mockResponse.token,
        token_type: "bearer",
        user_id: 103229049,
      };

      // Mock the popup hook to capture the onSuccess callback
      let capturedOnSuccess: ((response: any) => void) | undefined;
      mockUseGitHubAuthPopup.mockImplementation(({ onSuccess }) => {
        capturedOnSuccess = onSuccess;
        return mockPopupHandlers;
      });

      const { result } = renderHook(() => useAwaitAuthorization());

      const promise = result.current.awaitAuthorization();

      // Simulate successful authorization
      await act(async () => {
        capturedOnSuccess?.(mockResponse);
      });

      await expect(promise).resolves.toBe(mockResponse.token);

      expect(mockNotify).toHaveBeenCalledWith(
        "Authorization successful!",
        "success",
      );
      expect(mockAuthStorage.setJWT).toHaveBeenCalledWith(expectedJWT);
    });
  });

  describe("Error flow", () => {
    it("should handle authorization error", async () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const errorMessage = "access_denied";

      // Mock the popup hook to capture the onError callback
      let capturedOnError: ((error: string) => void) | undefined;
      mockUseGitHubAuthPopup.mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return mockPopupHandlers;
      });

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      const promise = result.current.awaitAuthorization();

      // Simulate authorization error and ensure promise is handled properly
      let promiseRejected = false;
      const rejectionHandler = promise.catch((error) => {
        promiseRejected = true;
        expect(error.message).toBe(`Authorization failed: ${errorMessage}`);
      });

      await act(async () => {
        capturedOnError?.(errorMessage);
      });

      await rejectionHandler;

      expect(promiseRejected).toBe(true);
      expect(mockNotify).toHaveBeenCalledWith(
        `Authorization error: ${errorMessage}`,
        "error",
      );
      expect(mockAuthStorage.clear).toHaveBeenCalled();
    });
  });

  describe("Close flow", () => {
    it("should resolve promise when popup closes and user is authorized", async () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      // Mock token to be available after popup closes
      mockAuthStorage.getToken.mockReturnValue("bearer token123");

      // Mock the popup hook to capture the onClose callback
      let capturedOnClose: (() => void) | undefined;
      mockUseGitHubAuthPopup.mockImplementation(({ onClose }) => {
        capturedOnClose = onClose;
        return mockPopupHandlers;
      });

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      const promise = result.current.awaitAuthorization();

      // Simulate popup close with token available
      await act(async () => {
        capturedOnClose?.();
      });

      await expect(promise).resolves.toBe("bearer token123");
    });

    it("should reject promise when popup closes and user is not authorized", async () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      // Mock the popup hook to capture the onClose callback
      let capturedOnClose: (() => void) | undefined;
      mockUseGitHubAuthPopup.mockImplementation((options) => {
        capturedOnClose = options.onClose;
        return mockPopupHandlers;
      });

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      const promise = result.current.awaitAuthorization();

      // Simulate popup close without token and ensure promise is handled properly
      let promiseRejected = false;
      const rejectionHandler = promise.catch((error) => {
        promiseRejected = true;
        expect(error.message).toBe("Authorization required");
      });

      await act(async () => {
        capturedOnClose?.();
      });

      await rejectionHandler;

      expect(promiseRejected).toBe(true);
    });
  });

  describe("Popup state propagation", () => {
    it("should propagate isLoading from popup hook", () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      mockPopupHandlers.isLoading = true;

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it("should propagate isPopupOpen from popup hook", () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      mockPopupHandlers.isPopupOpen = true;

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      expect(result.current.isPopupOpen).toBe(true);
    });

    it("should propagate closePopup from popup hook", () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      result.current.closePopup();

      expect(mockPopupHandlers.closePopup).toHaveBeenCalled();
    });

    it("should propagate bringPopupToFront from popup hook", () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      result.current.bringPopupToFront();

      expect(mockPopupHandlers.bringPopupToFront).toHaveBeenCalled();
    });
  });

  describe("Token subscription", () => {
    it("should subscribe to token changes", () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      renderHook(() => useAwaitAuthorization(), { wrapper });

      expect(mockAuthStorage.subscribe).toHaveBeenCalled();
    });

    it("should update isAuthorized when token changes", () => {
      let subscribedCallback: (() => void) | undefined;
      mockAuthStorage.subscribe.mockImplementation((callback) => {
        subscribedCallback = callback;
        return () => {};
      });

      // Initially no token
      mockAuthStorage.getToken.mockReturnValue(undefined);

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      expect(result.current.isAuthorized).toBe(false);

      // Mock token being available
      mockAuthStorage.getToken.mockReturnValue("bearer token123");

      // Trigger the subscription callback
      act(() => {
        subscribedCallback?.();
      });

      expect(result.current.isAuthorized).toBe(true);
    });
  });

  describe("Memory stability", () => {
    it("should memoize returned object to prevent unnecessary re-renders", () => {
      mockAuthStorage.getToken.mockReturnValue(undefined);
      mockAuthStorage.subscribe.mockReturnValue(() => {});

      const { result, rerender } = renderHook(() => useAwaitAuthorization(), {
        wrapper,
      });

      const firstResult = result.current;

      rerender();

      const secondResult = result.current;

      expect(firstResult).toStrictEqual(secondResult);
    });

    it("should update returned object when dependencies change", () => {
      let subscribedCallback: (() => void) | undefined;
      mockAuthStorage.subscribe.mockImplementation((callback) => {
        subscribedCallback = callback;
        return () => {};
      });

      // Initially no token
      mockAuthStorage.getToken.mockReturnValue(undefined);

      const { result } = renderHook(() => useAwaitAuthorization(), { wrapper });

      const firstResult = result.current;
      expect(firstResult.isAuthorized).toBe(false);

      // Mock token being available
      mockAuthStorage.getToken.mockReturnValue("bearer token123");

      // Trigger the subscription callback
      act(() => {
        subscribedCallback?.();
      });

      const secondResult = result.current;
      expect(secondResult.isAuthorized).toBe(true);
      expect(firstResult).not.toStrictEqual(secondResult);
    });
  });
});
