import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const pageListener = vi.fn();

const pasteAt = (target: EventTarget) => {
  target.dispatchEvent(new Event("paste", { bubbles: true }));
};

const field = () => document.querySelector("input")!;

beforeEach(() => {
  pageListener.mockClear();
  window.addEventListener("paste", pageListener);
});

afterEach(() => {
  window.removeEventListener("paste", pageListener);
  cleanup();
});

describe("useModalClipboardGuard", () => {
  test("keeps a background paste from reaching the page", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Create subgraph</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    pasteAt(document.body);

    expect(pageListener).not.toHaveBeenCalled();
  });

  test("keeps a paste aimed at the dialog from reaching the page", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Create subgraph</DialogTitle>
          <input />
        </DialogContent>
      </Dialog>,
    );

    pasteAt(field());

    expect(pageListener).not.toHaveBeenCalled();
  });

  test("still delivers a paste to handlers inside the dialog", () => {
    const dialogListener = vi.fn();
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Create subgraph</DialogTitle>
          <input onPaste={dialogListener} />
        </DialogContent>
      </Dialog>,
    );

    pasteAt(field());

    expect(dialogListener).toHaveBeenCalledOnce();
  });

  test("leaves the page alone while closed", () => {
    render(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Create subgraph</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    pasteAt(document.body);

    expect(pageListener).toHaveBeenCalledOnce();
  });

  test("releases the page once closed", () => {
    const { rerender } = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Create subgraph</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    rerender(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>Create subgraph</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    pasteAt(document.body);

    expect(pageListener).toHaveBeenCalledOnce();
  });

  test("keeps the page blocked while a stacked dialog closes", () => {
    const outer = (
      <Dialog open>
        <DialogContent>
          <DialogTitle>Create subgraph</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    const inner = (open: boolean) => (
      <Dialog open={open}>
        <DialogContent>
          <DialogTitle>Confirm</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    const { rerender } = render(
      <>
        {outer}
        {inner(true)}
      </>,
    );
    rerender(
      <>
        {outer}
        {inner(false)}
      </>,
    );

    pasteAt(document.body);

    expect(pageListener).not.toHaveBeenCalled();
  });

  test("leaves the page alone for a non-modal dialog", () => {
    render(
      <Dialog open modal={false}>
        <DialogContent>
          <DialogTitle>Component details</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    pasteAt(document.body);

    expect(pageListener).toHaveBeenCalledOnce();
  });

  test("keeps a paste aimed at a non-modal dialog from reaching the page", () => {
    render(
      <Dialog open modal={false}>
        <DialogContent>
          <DialogTitle>Component details</DialogTitle>
          <button>Publish</button>
        </DialogContent>
      </Dialog>,
    );

    pasteAt(screen.getByRole("button", { name: "Publish" }));

    expect(pageListener).not.toHaveBeenCalled();
  });

  test("still delivers a paste to handlers inside a non-modal dialog", () => {
    const dialogListener = vi.fn();
    render(
      <Dialog open modal={false}>
        <DialogContent>
          <DialogTitle>Component details</DialogTitle>
          <input onPaste={dialogListener} />
        </DialogContent>
      </Dialog>,
    );

    pasteAt(field());

    expect(dialogListener).toHaveBeenCalledOnce();
  });

  test("keeps a background paste from reaching the page behind an alert dialog nested in a non-modal dialog", () => {
    render(
      <Dialog open modal={false}>
        <DialogContent>
          <DialogTitle>Component details</DialogTitle>
          <AlertDialog open>
            <AlertDialogContent>
              <AlertDialogTitle>Deprecate component</AlertDialogTitle>
            </AlertDialogContent>
          </AlertDialog>
        </DialogContent>
      </Dialog>,
    );

    pasteAt(document.body);

    expect(pageListener).not.toHaveBeenCalled();
  });

  test.each([
    [
      "an alert dialog",
      () => (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogTitle>Delete task</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>
      ),
    ],
    [
      "a sheet",
      () => (
        <Sheet open>
          <SheetContent>
            <SheetTitle>Task details</SheetTitle>
          </SheetContent>
        </Sheet>
      ),
    ],
  ])(
    "keeps a background paste from reaching the page behind %s",
    (_, renderSurface) => {
      render(renderSurface());

      pasteAt(document.body);

      expect(pageListener).not.toHaveBeenCalled();
    },
  );
});
