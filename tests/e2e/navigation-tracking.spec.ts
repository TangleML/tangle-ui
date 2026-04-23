import { expect, test } from "@playwright/test";

test.describe("Navigation tracking", () => {
  test("emits page_view events with route metadata on navigation", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__analyticsEvents = [];
      window.addEventListener("tangle.analytics.track", (e) => {
        const detail = (e as CustomEvent).detail;
        if (detail.actionType === "page_view") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__analyticsEvents.push(detail);
        }
      });
    });

    await page.goto("/");
    await expect(
      page.locator("[data-testid='app-menu-actions']"),
    ).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings/);

    const events = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__analyticsEvents,
    );

    expect(events.length).toBeGreaterThanOrEqual(2);

    const [initial, navigation] = events;

    // First page_view from landing on /
    expect(initial.actionType).toBe("page_view");
    expect(initial.metadata).toMatchObject({
      to: "/",
      route_pattern: expect.any(String),
    });

    // Second page_view from navigating to settings
    expect(navigation.actionType).toBe("page_view");
    expect(navigation.metadata).toMatchObject({
      from: "/",
      to: expect.stringContaining("/settings"),
      route_pattern: expect.any(String),
    });
  });

  test("captures search params in page_view metadata", async ({ page }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__analyticsEvents = [];
      window.addEventListener("tangle.analytics.track", (e) => {
        const detail = (e as CustomEvent).detail;
        if (detail.actionType === "page_view") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__analyticsEvents.push(detail);
        }
      });
    });

    await page.goto("/settings/backend?region=us-east-1&mode=verbose");
    await expect(
      page.locator("[data-testid='app-menu-actions']"),
    ).toBeVisible();

    const events = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__analyticsEvents,
    );

    expect(events.length).toBeGreaterThanOrEqual(1);

    const event = events[0];
    expect(event.metadata).toMatchObject({
      to: "/settings/backend",
      search: expect.objectContaining({
        region: "us-east-1",
        mode: "verbose",
      }),
    });
  });
});
