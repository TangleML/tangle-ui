import "@testing-library/jest-dom/vitest";

// Polyfill ES2024 Set methods used by app code (e.g. computeDiff in
// task.utils.ts). They ship in every browser we target, but CI runs the test
// suite on Node 20, which predates them. Without this, any test that exercises
// that code throws "Set.prototype.difference is not a function".
if (typeof Set.prototype.difference !== "function") {
  Set.prototype.difference = function difference(other) {
    const result = new Set();
    for (const value of this) {
      if (!other.has(value)) result.add(value);
    }
    return result;
  };
}

if (typeof Set.prototype.intersection !== "function") {
  Set.prototype.intersection = function intersection(other) {
    const result = new Set();
    for (const value of this) {
      if (other.has(value)) result.add(value);
    }
    return result;
  };
}
