import { test } from "@playwright/test";

import { loadTour, runTour } from "./tourDriver";

const tour = loadTour("firstPipeline.tour.json");

test.describe("Guided tour: Build Your First Pipeline", () => {
  test("replicates every step of the first-pipeline tour", async ({ page }) => {
    await runTour(page, tour);
  });
});
