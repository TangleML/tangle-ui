import { expect, it } from "vitest";

import { WindowStoreImpl } from "./windowStore";

function open(store: WindowStoreImpl, id: string) {
  store.openWindow(null, { id, title: id, defaultDockState: "right" });
  return store.getWindowById(id)!;
}

it("keeps accordion events, restore history, and cleanup inside their window store", () => {
  const first = new WindowStoreImpl();
  const second = new WindowStoreImpl();
  const stopFirst = first.enableDockAreaAccordion("right");
  const stopSecond = second.enableDockAreaAccordion("right");

  const firstDetails = open(first, "details");
  const firstProperties = open(first, "properties");
  expect(firstDetails.isMinimized).toBe(true);

  const secondDetails = open(second, "details");
  expect(firstProperties.isMinimized).toBe(false);
  const secondProperties = open(second, "properties");
  expect(secondDetails.isMinimized).toBe(true);

  firstProperties.close();
  expect(firstDetails.isMinimized).toBe(false);
  expect(secondDetails.isMinimized).toBe(true);
  expect(secondProperties.isMinimized).toBe(false);

  stopFirst();
  secondProperties.minimize();
  expect(secondDetails.isMinimized).toBe(false);
  expect(secondProperties.isMinimized).toBe(true);
  stopSecond();
});
