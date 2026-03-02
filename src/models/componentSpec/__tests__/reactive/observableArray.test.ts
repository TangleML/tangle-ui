import { describe, expect, it, vi } from "vitest";

import { ObservableArray } from "../../reactive/observableArray";

describe("ObservableArray", () => {
  it("emits on add", () => {
    const arr = new ObservableArray<string>();
    const listener = vi.fn();
    arr.subscribe("changed.self.*", listener);

    arr.add("item");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "changed.self.collection",
        field: "items",
      }),
    );
    expect(arr.all).toEqual(["item"]);
  });

  it("emits on remove", () => {
    const arr = new ObservableArray<string>();
    arr.add("a");
    arr.add("b");
    const listener = vi.fn();
    arr.subscribe("changed.self.*", listener);

    const removed = arr.remove(0);

    expect(removed).toBe("a");
    expect(arr.all).toEqual(["b"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits on removeBy", () => {
    const arr = new ObservableArray<{ id: number }>();
    arr.add({ id: 1 });
    arr.add({ id: 2 });
    arr.add({ id: 3 });
    const listener = vi.fn();
    arr.subscribe("changed.self.*", listener);

    const removed = arr.removeBy((item) => item.id === 2);

    expect(removed).toEqual([{ id: 2 }]);
    expect(arr.length).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not emit on removeBy when nothing matches", () => {
    const arr = new ObservableArray<{ id: number }>();
    arr.add({ id: 1 });
    const listener = vi.fn();
    arr.subscribe("changed.self.*", listener);

    const removed = arr.removeBy((item) => item.id === 999);

    expect(removed).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("emits on update", () => {
    const arr = new ObservableArray<{ name: string }>();
    arr.add({ name: "old" });
    const listener = vi.fn();
    arr.subscribe("changed.self.*", listener);

    arr.update(0, { name: "new" });

    expect(arr.at(0)?.name).toBe("new");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits on set", () => {
    const arr = new ObservableArray<string>();
    arr.add("a");
    const listener = vi.fn();
    arr.subscribe("changed.self.*", listener);

    arr.set(0, "b");

    expect(arr.at(0)).toBe("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits on clear", () => {
    const arr = new ObservableArray<string>();
    arr.add("a");
    arr.add("b");
    const listener = vi.fn();
    arr.subscribe("changed.self.*", listener);

    arr.clear();

    expect(arr.length).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not emit on read operations", () => {
    const arr = new ObservableArray<string>();
    arr.add("a");
    arr.add("b");
    const listener = vi.fn();
    arr.subscribe("changed.self.*", listener);

    arr.at(0);
    arr.find((x) => x === "a");
    arr.filter((x) => x === "a");
    arr.map((x) => x.toUpperCase());
    arr.some((x) => x === "a");
    arr.every((x) => x.length > 0);
    arr.findIndex((x) => x === "a");

    expect(listener).not.toHaveBeenCalled();
  });

  it("supports iteration", () => {
    const arr = new ObservableArray<string>();
    arr.add("a");
    arr.add("b");

    const result = [...arr];

    expect(result).toEqual(["a", "b"]);
  });

  it("unsubscribe stops events", () => {
    const arr = new ObservableArray<string>();
    const listener = vi.fn();
    const unsub = arr.subscribe("changed.self.*", listener);

    arr.add("a");
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    arr.add("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("length property returns correct count", () => {
    const arr = new ObservableArray<string>();
    expect(arr.length).toBe(0);

    arr.add("a");
    expect(arr.length).toBe(1);

    arr.add("b");
    expect(arr.length).toBe(2);

    arr.remove(0);
    expect(arr.length).toBe(1);
  });

  it("all returns readonly array", () => {
    const arr = new ObservableArray<string>();
    arr.add("a");

    const all = arr.all;
    expect(all).toEqual(["a"]);
  });

  it("find returns correct item", () => {
    const arr = new ObservableArray<{ id: number; name: string }>();
    arr.add({ id: 1, name: "Alice" });
    arr.add({ id: 2, name: "Bob" });

    const found = arr.find((item) => item.id === 2);
    expect(found).toEqual({ id: 2, name: "Bob" });
  });

  it("findIndex returns correct index", () => {
    const arr = new ObservableArray<string>();
    arr.add("a");
    arr.add("b");
    arr.add("c");

    const idx = arr.findIndex((x) => x === "b");
    expect(idx).toBe(1);
  });

  it("filter returns matching items", () => {
    const arr = new ObservableArray<number>();
    arr.add(1);
    arr.add(2);
    arr.add(3);
    arr.add(4);

    const evens = arr.filter((x) => x % 2 === 0);
    expect(evens).toEqual([2, 4]);
  });

  it("map transforms items", () => {
    const arr = new ObservableArray<number>();
    arr.add(1);
    arr.add(2);

    const doubled = arr.map((x) => x * 2);
    expect(doubled).toEqual([2, 4]);
  });

  it("some returns true when any item matches", () => {
    const arr = new ObservableArray<number>();
    arr.add(1);
    arr.add(2);
    arr.add(3);

    expect(arr.some((x) => x === 2)).toBe(true);
    expect(arr.some((x) => x === 5)).toBe(false);
  });

  it("every returns true when all items match", () => {
    const arr = new ObservableArray<number>();
    arr.add(2);
    arr.add(4);
    arr.add(6);

    expect(arr.every((x) => x % 2 === 0)).toBe(true);
    arr.add(3);
    expect(arr.every((x) => x % 2 === 0)).toBe(false);
  });

  it("subscribes to specific collection event type", () => {
    const arr = new ObservableArray<string>();
    const listener = vi.fn();
    arr.subscribe("changed.self.collection", listener);

    arr.add("test");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not receive entity events when subscribed to collection only", () => {
    const arr = new ObservableArray<string>();
    const listener = vi.fn();
    arr.subscribe("changed.self.entity", listener);

    arr.add("test");

    expect(listener).not.toHaveBeenCalled();
  });
});
