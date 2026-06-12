import { test } from "@playwright/test";

import { loadTour, runTour } from "./tourDriver";

const tour = loadTour("navigatingEditor.tour.json");

test.describe("Guided tour: Navigating the Editor", () => {
  test("replicates every step of the navigating-the-editor tour", async ({
    page,
  }) => {
    await runTour(page, tour);
  });
});
