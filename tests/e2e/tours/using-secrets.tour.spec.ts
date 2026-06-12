import { expect, test } from "@playwright/test";

import { loadTour, runTour } from "./tourDriver";

const tour = loadTour("usingSecrets.tour.json");

test.describe("Guided tour: Using Secrets", () => {
  test("runs hands-on against the in-memory mock with no backend", async ({
    page,
  }) => {
    // Drive the no-backend path: fail the health ping so `available` stays false
    // and the tour's `mockBackend` activates. Fail /api/secrets too so the
    // secret steps can only pass if they're served by the in-memory mock — if
    // the mock didn't activate, the real call would 503 and the tour would stall.
    let secretsApiCalls = 0;
    await page.route(/\/services\/ping/, (route) =>
      route.fulfill({ status: 503, body: "down" }),
    );
    await page.route(/\/api\/secrets/, (route) => {
      secretsApiCalls += 1;
      return route.fulfill({ status: 503, body: "down" });
    });

    await runTour(page, tour);

    // The secret steps were served entirely by the in-memory mock.
    expect(
      secretsApiCalls,
      "secrets must be served by the in-memory mock, not the API",
    ).toBe(0);

    // Real run submission isn't wired in mock mode — the assignment is
    // demonstrated, but the Submit Run confirm stays disabled.
    await expect(
      page.locator('[data-tour="submit-arguments-confirm"]'),
      "Submit Run should be disabled in mock mode",
    ).toBeDisabled();
  });
});
