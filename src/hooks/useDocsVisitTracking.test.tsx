import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DOCUMENTATION_URL, PRIVACY_POLICY_URL } from "@/utils/constants";

import { useDocsVisitTracking } from "./useDocsVisitTracking";

function clickLink(href: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  // Prevent jsdom from attempting real navigation; the capture-phase listener
  // under test has already run by the time this fires.
  anchor.addEventListener("click", (e) => e.preventDefault());
  document.body.append(anchor);
  anchor.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  anchor.remove();
}

describe("useDocsVisitTracking", () => {
  let onVisit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onVisit = vi.fn();
    renderHook(() => useDocsVisitTracking(onVisit));
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fires when a docs link is clicked", () => {
    clickLink(DOCUMENTATION_URL);
    expect(onVisit).toHaveBeenCalledTimes(1);
  });

  it("fires for nested docs pages too", () => {
    clickLink(`${DOCUMENTATION_URL}getting-started/first-pipeline/`);
    expect(onVisit).toHaveBeenCalledTimes(1);
  });

  it("does not fire for the privacy policy (lives under the docs URL)", () => {
    clickLink(PRIVACY_POLICY_URL);
    expect(onVisit).not.toHaveBeenCalled();
  });

  it("does not fire for non-docs links", () => {
    clickLink("https://example.com/");
    expect(onVisit).not.toHaveBeenCalled();
  });

  it("ignores clicks that are not on a link", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.remove();
    expect(onVisit).not.toHaveBeenCalled();
  });
});
