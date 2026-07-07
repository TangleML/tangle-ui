import { test } from "@playwright/test";

import { loadTour, runTour } from "./tourDriver";

const tour = loadTour("subgraphs.tour.json");

test.describe("Guided tour: Subgraphs", () => {
  test("replicates every step of the subgraphs tour", async ({ page }) => {
    await runTour(page, tour);
  });
});
