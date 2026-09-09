import { expect, test } from "@playwright/test";

for (const { width, maxColumns, counts } of [
  { width: 375, maxColumns: 1, counts: [4] },
  { width: 900, maxColumns: 2, counts: [3, 5] },
  { width: 1440, maxColumns: 3, counts: [1, 2, 3, 4, 5, 7, 8, 10, 11] },
]) {
  for (const count of counts) {
    test(`${count} notices fill every row at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/dashboard");
      await page.evaluate((count) => {
        const notices = Array.from({ length: count }, (_, index) => ({
          id: `layout-test-${index}`,
          title: `Test notice ${index + 1}`,
          body: "Sample notice content for checking row layout.",
          variant: "info",
        }));
        window.__TANGLE_NOTICE_SOURCE__ = {
          version: 1,
          getSnapshot: () => notices,
          subscribe: () => () => {},
        };
        window.dispatchEvent(new CustomEvent("tangle:notice-source"));
      }, count);

      const banners = page.getByTestId("notice-banners");
      await expect(banners.getByTestId("info-box-info")).toHaveCount(count);
      await expect(banners).toBeVisible();

      const layout = await banners.evaluate((element) => {
        const { left, width } = element.getBoundingClientRect();
        return {
          left,
          width,
          gap: parseFloat(getComputedStyle(element).columnGap),
          cards: [...element.children].map((card) => {
            const { left, top, width } = card.getBoundingClientRect();
            return { left, top, width };
          }),
        };
      });

      expect(new Set(layout.cards.map(({ top }) => top)).size).toBe(
        Math.ceil(count / maxColumns),
      );
      for (const [index, card] of layout.cards.entries()) {
        const column = index % maxColumns;
        const rowStart = index - column;
        const columnsInRow = Math.min(maxColumns, count - rowStart);
        const cardWidth =
          (layout.width - layout.gap * (columnsInRow - 1)) / columnsInRow;

        expect(card.width).toBeCloseTo(cardWidth, 1);
        expect(card.left).toBeCloseTo(
          layout.left + column * (cardWidth + layout.gap),
          1,
        );
        expect(card.top).toBe(layout.cards[rowStart]?.top);
      }
    });
  }
}
