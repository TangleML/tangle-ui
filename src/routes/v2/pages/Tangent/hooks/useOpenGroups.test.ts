import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useOpenGroups } from "./useOpenGroups";

const KEY = "tangent-sidebar-expanded-projects";

function mount(
  options: Partial<Parameters<typeof useOpenGroups>[1]> = {},
  initialProps = { searching: false },
) {
  return renderHook(
    ({ searching }: { searching: boolean }) =>
      useOpenGroups(KEY, { defaultOpen: false, ...options, searching }),
    { initialProps },
  );
}

describe("useOpenGroups", () => {
  beforeEach(() => localStorage.clear());

  it("opens every group by default only when told to", () => {
    expect(mount().result.current.isOpen("a")).toBe(false);
    expect(mount({ defaultOpen: true }).result.current.isOpen("a")).toBe(true);
  });

  it("remembers what was opened and closed across mounts", () => {
    const first = mount({ defaultOpen: true });
    act(() => first.result.current.setOpen("a", false));
    expect(first.result.current.isOpen("a")).toBe(false);
    first.unmount();

    const second = mount({ defaultOpen: true });

    expect(second.result.current.isOpen("a")).toBe(false);
    expect(second.result.current.isOpen("b")).toBe(true);
  });

  it("starts with the given group open without remembering it", () => {
    const first = mount({ initiallyOpen: "a" });
    expect(first.result.current.isOpen("a")).toBe(true);
    first.unmount();

    expect(mount().result.current.isOpen("a")).toBe(false);
  });

  it("reveals a group for this mount only", () => {
    const first = mount();
    act(() => first.result.current.reveal("a"));
    expect(first.result.current.isOpen("a")).toBe(true);
    first.unmount();

    expect(mount().result.current.isOpen("a")).toBe(false);
  });

  it("opens a group with matches while searching until it is closed in that search", () => {
    const hook = mount({}, { searching: true });

    expect(hook.result.current.isOpen("a", { hasMatches: true })).toBe(true);
    expect(hook.result.current.isOpen("a")).toBe(false);

    act(() => hook.result.current.setOpen("a", false));

    expect(hook.result.current.isOpen("a", { hasMatches: true })).toBe(false);
  });

  it("keeps what changed while searching out of the remembered layout", () => {
    const hook = mount({}, { searching: true });

    act(() => hook.result.current.setOpen("a", true));
    expect(hook.result.current.isOpen("a")).toBe(true);

    act(() => hook.result.current.forgetSearch());
    expect(hook.result.current.isOpen("a")).toBe(false);

    act(() => hook.result.current.setOpen("a", true));
    hook.rerender({ searching: false });
    expect(hook.result.current.isOpen("a")).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
