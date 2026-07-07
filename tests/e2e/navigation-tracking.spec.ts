import { expect, test } from "@playwright/test";

test.describe("Navigation tracking", () => {
  test("emits page_view events with route metadata on navigation", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).__analyticsEvents = [];
      window.addEventListener("tangle.analytics.track", (e) => {
        const detail = (e as CustomEvent).detail;
        if (detail.actionType === "page_view") {
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

    const events = await page.evaluate(() => (window as any).__analyticsEvents);

    expect(events.length).toBeGreaterThanOrEqual(2);

    const landing = events.find(
      (e: { metadata?: { to?: string } }) =>
        e.metadata?.to === "/welcome" || e.metadata?.to === "/dashboard",
    );
    expect(landing).toBeTruthy();
    expect(landing.metadata).toMatchObject({
      to: expect.stringMatching(/^\/(welcome|dashboard)$/),
      route_pattern: expect.any(String),
    });

    // Navigating to settings emits a page_view.
    const navigation = events.find(
      (e: { metadata?: { to?: string } }) =>
        typeof e.metadata?.to === "string" &&
        e.metadata.to.includes("/settings"),
    );
    expect(navigation).toBeTruthy();
    expect(navigation.metadata).toMatchObject({
      to: expect.stringContaining("/settings"),
      route_pattern: expect.any(String),
    });
  });

  test("captures search params in page_view metadata", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__analyticsEvents = [];
      window.addEventListener("tangle.analytics.track", (e) => {
        const detail = (e as CustomEvent).detail;
        if (detail.actionType === "page_view") {
          (window as any).__analyticsEvents.push(detail);
        }
      });
    });

    await page.goto("/settings/backend?region=us-east-1&mode=verbose");
    await expect(
      page.locator("[data-testid='app-menu-actions']"),
    ).toBeVisible();

    const events = await page.evaluate(() => (window as any).__analyticsEvents);

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
