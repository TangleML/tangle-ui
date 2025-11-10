import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import type { OasisAuthResponse } from "@/components/shared/Authentication/types";

import { useGitHubAuthPopup } from "../useGitHubAuthPopup";

vi.mock("@/utils/constants", async (importOriginal) => ({
  ...(await importOriginal()),
  API_URL: "https://api.example.com",
  APP_ROUTES: {
    GITHUB_AUTH_CALLBACK: "/authorize/github",
  },
}));

describe("useGitHubAuthPopup()", () => {
  let mockPopup: any;
  let mockOnSuccess: Mock;
  let mockOnError: Mock;
  let mockOnClose: Mock;
  let mockFetch: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");
    vi.stubEnv("VITE_BACKEND_API_URL", "https://api.example.com");

    // Mock popup window
    mockPopup = {
      focus: vi.fn(),
      close: vi.fn(),
      closed: false,
      location: {
        origin: "https://github.com",
        href: "https://github.com/login/oauth/authorize",
        search: "",
      },
    };

    // Mock window.open
    vi.spyOn(window, "open").mockImplementation(() => mockPopup);

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock window properties
    Object.defineProperty(window, "screen", {
      writable: true,
      configurable: true,
      value: {
        width: 1024,
        height: 768,
      },
    });
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: {
        origin: "https://example.com",
      },
    });

    // Mock callback functions
    mockOnSuccess = vi.fn();
    mockOnError = vi.fn();
    mockOnClose = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("openPopup", () => {
    it("should open popup with correct parameters", () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining("https://github.com/login/oauth/authorize"),
        "github-auth",
        "width=600,height=700,left=212,top=34,scrollbars=yes,resizable=yes",
      );
      expect(result.current.isPopupOpen).toBe(true);
      expect(result.current.isLoading).toBe(true);
      expect(mockPopup.focus).toHaveBeenCalled();
    });

    it("should focus existing popup if already open", () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      // Reset focus mock
      mockPopup.focus.mockClear();

      act(() => {
        result.current.openPopup();
      });

      expect(mockPopup.focus).toHaveBeenCalled();
      expect(window.open).toHaveBeenCalledTimes(1); // Should not open new popup
    });

    it("should handle popup blocker", () => {
      vi.spyOn(window, "open").mockImplementation(() => null);

      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      expect(mockOnError).toHaveBeenCalledWith(
        "Failed to open popup window. Please check your popup blocker settings.",
      );
      expect(result.current.isLoading).toBe(false);
    });

    it("should build correct auth URL", () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      const expectedUrl = new URL("https://github.com/login/oauth/authorize");
      expectedUrl.searchParams.set("client_id", "test-client-id");
      expectedUrl.searchParams.set(
        "redirect_uri",
        "https://example.com/authorize/github",
      );
      expectedUrl.searchParams.set("scope", "read:user");
      expectedUrl.searchParams.set("state", "");

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining(expectedUrl.toString()),
        "github-auth",
        "width=600,height=700,left=212,top=34,scrollbars=yes,resizable=yes",
      );
    });
  });

  describe("closePopup", () => {
    it("should close popup and do cleanup", () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      act(() => {
        result.current.closePopup();
      });

      expect(result.current.isPopupOpen).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(mockOnClose).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("bringPopupToFront", () => {
    it("should focus popup if open", () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      mockPopup.focus.mockClear();

      act(() => {
        result.current.bringPopupToFront();
      });

      expect(mockPopup.focus).toHaveBeenCalled();
    });

    it("should not focus closed popup", () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      mockPopup.closed = true;

      act(() => {
        result.current.bringPopupToFront();
      });

      expect(mockPopup.focus).not.toHaveBeenCalled();
    });
  });

  describe("OAuth flow", () => {
    it("should handle successful authorization", async () => {
      const mockResponse: OasisAuthResponse = {
        token: "test-token",
        token_type: "JWT",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      // Simulate popup returning with auth code
      mockPopup.location = {
        origin: "https://example.com",
        href: "https://example.com/authorize/github?code=test-code",
        search: "?code=test-code",
      };

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/auth/github/callback?code=test-code&state=",
        ),
      );
      expect(mockOnSuccess).toHaveBeenCalledWith(mockResponse);
    });

    it("should handle authorization error", async () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      // Simulate popup returning with error
      mockPopup.location = {
        origin: "https://example.com",
        href: "https://example.com/authorize/github?error=access_denied",
        search: "?error=access_denied",
      };

      await act(async () => {
        vi.advanceTimersByTime(1001);
      });

      expect(mockOnError).toHaveBeenCalledWith("access_denied");
    });

    it("should handle token exchange error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      // Simulate popup returning with auth code
      mockPopup.location = {
        origin: "https://example.com",
        href: "https://example.com/authorize/github?code=test-code",
        search: "?code=test-code",
      };

      await act(async () => {
        vi.advanceTimersByTime(1001);
      });

      expect(mockOnError).toHaveBeenCalledWith(
        "Failed to exchange code for token",
      );
    });

    it("should handle popup being closed by user", async () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      // Simulate popup being closed
      mockPopup.closed = true;

      await act(async () => {
        vi.advanceTimersByTime(1001);
      });

      expect(result.current.isPopupOpen).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should handle cross-origin errors gracefully", async () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      // Simulate cross-origin error by making location access throw
      Object.defineProperty(mockPopup, "location", {
        get: () => {
          throw new Error("Cross-origin error");
        },
      });

      await act(async () => {
        vi.advanceTimersByTime(1001);
      });

      // Should not crash and should continue monitoring
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });
  });

  describe("Keyboard handling", () => {
    it("should close popup on ESC key", () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      // Simulate ESC key press
      const escEvent = new KeyboardEvent("keydown", { key: "Escape" });
      act(() => {
        document.dispatchEvent(escEvent);
      });

      expect(result.current.isPopupOpen).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it("should not close popup on other keys", () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      // Simulate other key press
      const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
      act(() => {
        document.dispatchEvent(enterEvent);
      });

      expect(result.current.isPopupOpen).toBe(true);
    });

    it("should not handle ESC when popup is closed", () => {
      renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      // Simulate ESC key press when popup is not open
      const escEvent = new KeyboardEvent("keydown", { key: "Escape" });
      act(() => {
        document.dispatchEvent(escEvent);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup on unmount", () => {
      const { result, unmount } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("Popup positioning", () => {
    it("should center popup on screen", () => {
      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      expect(window.open).toHaveBeenCalledOnce();

      const [, , options] = (window.open as Mock).mock.calls[0];

      // Expected: left = (1024 - 600) / 2 = 212
      // Expected: top = (768 - 700) / 2 = 34
      expect(options).toContain("left=212");
      expect(options).toContain("top=34");
    });

    it("should not position popup below zero", () => {
      // Mock small screen
      Object.defineProperty(window, "screen", {
        value: {
          width: 400,
          height: 500,
        },
      });

      const { result } = renderHook(() =>
        useGitHubAuthPopup({
          onSuccess: mockOnSuccess,
          onError: mockOnError,
          onClose: mockOnClose,
        }),
      );

      act(() => {
        result.current.openPopup();
      });

      const [, , options] = (window.open as Mock).mock.calls[0];

      // Should not be negative
      expect(options).toContain("left=0");
      expect(options).toContain("top=0");
    });
  });
});
