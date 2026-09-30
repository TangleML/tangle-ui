import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAutoSaveOnLeave } from "./useAutoSaveOnLeave";

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

function createAutoSave() {
  return {
    flushPending: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    hasUnsavedChanges: false,
    isSaving: false,
    error: null as string | null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const disposeHarnesses: Array<() => void> = [];

async function renderEditor(autoSave = createAutoSave()) {
  let navigationPending: { current: boolean } | undefined;
  let setIsActive: ((active: boolean) => void) | undefined;

  function Editor() {
    const [isActive, setActive] = useState(true);
    const pending = useAutoSaveOnLeave(autoSave, isActive);
    useEffect(() => {
      setIsActive = setActive;
      navigationPending = pending;
    }, [pending]);
    return <div data-testid="editor">Editor</div>;
  }

  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const rootRoute = createRootRoute();
  const editorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/editor/$id",
    component: Editor,
  });
  const pipelinesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/pipelines",
    component: () => <div data-testid="pipelines">Pipeline list</div>,
  });
  const history = createMemoryHistory({
    initialEntries: ["/editor/local"],
  });
  const registerBlocker = vi.spyOn(history, "block");
  const router = createRouter({
    routeTree: rootRoute.addChildren([editorRoute, pipelinesRoute]),
    history,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  disposeHarnesses.push(() => {
    history.destroy();
    queryClient.clear();
  });

  await router.load();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByTestId("editor");

  return {
    ...view,
    router,
    history,
    registerBlocker,
    queryClient,
    get navigationPending() {
      return navigationPending!;
    },
    setIsActive(active: boolean) {
      setIsActive!(active);
    },
  };
}

afterEach(() => {
  cleanup();
  for (const dispose of disposeHarnesses.splice(0)) dispose();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("useAutoSaveOnLeave", () => {
  it("holds navigation until pending edits are saved and marks leaving synchronously", async () => {
    const autoSave = createAutoSave();
    autoSave.hasUnsavedChanges = true;
    const saving = deferred<boolean>();
    autoSave.flushPending.mockReturnValue(saving.promise);
    const editor = await renderEditor(autoSave);
    let navigation: Promise<void> | undefined;

    act(() => {
      navigation = editor.router.navigate({ href: "/pipelines" });
      expect(editor.navigationPending.current).toBe(true);
    });

    expect(autoSave.flushPending).toHaveBeenCalledOnce();
    expect(editor.history.location.pathname).toBe("/editor/local");
    expect(screen.queryByTestId("pipelines")).not.toBeInTheDocument();

    await act(async () => {
      autoSave.hasUnsavedChanges = false;
      saving.resolve(true);
      await navigation;
    });

    expect(await screen.findByTestId("pipelines")).toBeInTheDocument();
    expect(editor.history.location.pathname).toBe("/pipelines");
    expect(autoSave.flushPending).toHaveBeenCalledOnce();
  });

  it("keeps the editor open and releases the leaving flag if saving fails", async () => {
    const autoSave = createAutoSave();
    autoSave.hasUnsavedChanges = true;
    autoSave.error = "Server unavailable";
    autoSave.flushPending.mockResolvedValue(false);
    const editor = await renderEditor(autoSave);

    act(() => {
      void editor.router.navigate({ href: "/pipelines" });
    });

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(notify).toHaveBeenCalledWith(expect.any(String), "error");
    expect(editor.history.location.pathname).toBe("/editor/local");
    expect(screen.getByTestId("editor")).toBeInTheDocument();
    expect(editor.navigationPending.current).toBe(false);
    expect(autoSave.hasUnsavedChanges).toBe(true);
  });

  it.each(["panel=details", "fileId=other"])(
    "flushes before same-path navigation changes %s",
    async (search) => {
      const autoSave = createAutoSave();
      autoSave.hasUnsavedChanges = true;
      const saving = deferred<boolean>();
      autoSave.flushPending.mockReturnValue(saving.promise);
      const editor = await renderEditor(autoSave);
      let navigation: Promise<void> | undefined;

      act(() => {
        navigation = editor.router.navigate({
          href: `/editor/local?${search}`,
        });
      });
      expect(autoSave.flushPending).toHaveBeenCalledOnce();
      expect(editor.history.location.search).toBe("");

      await act(async () => {
        saving.resolve(true);
        await navigation;
      });

      expect(editor.history.location.search).toBe(`?${search}`);
      expect(editor.navigationPending.current).toBe(false);
    },
  );

  it("waits for saving when external navigation supplies the current location twice", async () => {
    const autoSave = createAutoSave();
    autoSave.hasUnsavedChanges = true;
    const saving = deferred<boolean>();
    autoSave.flushPending.mockReturnValue(saving.promise);
    const editor = await renderEditor(autoSave);
    const blocker = editor.registerBlocker.mock.calls.at(-1)?.[0];
    expect(blocker).toBeDefined();

    const result = blocker!.blockerFn({
      currentLocation: editor.history.location,
      nextLocation: editor.history.location,
      action: "PUSH",
    });
    expect(autoSave.flushPending).toHaveBeenCalledOnce();
    expect(editor.navigationPending.current).toBe(true);
    saving.resolve(true);
    expect(await result).toBe(false);
  });

  it("clears the leaving flag after navigating to another pipeline", async () => {
    const autoSave = createAutoSave();
    autoSave.hasUnsavedChanges = true;
    const editor = await renderEditor(autoSave);

    await act(async () => {
      await editor.router.navigate({ href: "/editor/other" });
    });

    expect(editor.history.location.pathname).toBe("/editor/other");
    await waitFor(() => expect(editor.navigationPending.current).toBe(false));
    expect(autoSave.flushPending).toHaveBeenCalledOnce();
  });

  it.each([
    { hasUnsavedChanges: true, isSaving: false },
    { hasUnsavedChanges: false, isSaving: true },
  ])(
    "flushes and prompts on unload while work is unfinished: %j",
    async (state) => {
      const autoSave = { ...createAutoSave(), ...state };
      const saving = deferred<boolean>();
      autoSave.flushPending.mockReturnValue(saving.promise);
      await renderEditor(autoSave);
      const event = new Event("beforeunload", { cancelable: true });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(autoSave.flushPending).toHaveBeenCalledOnce();
      expect(event.defaultPrevented).toBe(true);
      await act(async () => saving.resolve(true));
    },
  );

  it("does not flush or prompt on unload when everything is saved", async () => {
    const autoSave = createAutoSave();
    await renderEditor(autoSave);
    const event = new Event("beforeunload", { cancelable: true });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(autoSave.flushPending).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("flushes when the browser tab becomes hidden", async () => {
    const autoSave = createAutoSave();
    autoSave.hasUnsavedChanges = true;
    await renderEditor(autoSave);
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(autoSave.flushPending).not.toHaveBeenCalled();

    visibility.mockReturnValue("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(autoSave.flushPending).toHaveBeenCalledOnce();
  });

  it("flushes on pagehide", async () => {
    const autoSave = createAutoSave();
    autoSave.hasUnsavedChanges = true;
    await renderEditor(autoSave);

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(autoSave.flushPending).toHaveBeenCalledOnce();
  });

  it("flushes when an embedded editor becomes inactive", async () => {
    const autoSave = createAutoSave();
    autoSave.hasUnsavedChanges = true;
    const editor = await renderEditor(autoSave);
    expect(autoSave.flushPending).not.toHaveBeenCalled();

    await act(async () => editor.setIsActive(false));

    expect(autoSave.flushPending).toHaveBeenCalledOnce();
    expect(editor.history.location.pathname).toBe("/editor/local");
    expect(editor.navigationPending.current).toBe(false);

    await act(async () => editor.setIsActive(true));
    expect(autoSave.flushPending).toHaveBeenCalledOnce();
  });

  it("removes browser event listeners when the editor unmounts", async () => {
    const autoSave = createAutoSave();
    autoSave.hasUnsavedChanges = true;
    const editor = await renderEditor(autoSave);
    editor.unmount();
    autoSave.flushPending.mockClear();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const unload = new Event("beforeunload", { cancelable: true });

    act(() => {
      window.dispatchEvent(unload);
      window.dispatchEvent(new Event("pagehide"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(autoSave.flushPending).not.toHaveBeenCalled();
    expect(unload.defaultPrevented).toBe(false);
  });
});
