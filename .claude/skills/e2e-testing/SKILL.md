---
name: e2e-testing
description: Playwright E2E testing best practices for this project. Use when writing, modifying, or reviewing E2E tests.
---

# E2E Testing Best Practices (Playwright)

## Setup

- Use Playwright helpers from `tests/e2e/helpers.ts`
- Use `data-testid` attributes for stable selectors
- Write descriptive test names that explain user behavior
- Ensure tests are isolated and can run independently

## Never Use Hard-Coded Timeouts

```typescript
// Bad
await element.click();
await page.waitForTimeout(200);

// Good
await element.click();
await expect(otherElement).toBeVisible();
```

## Use Playwright's Auto-Waiting

```typescript
// Bad
if (await element.isVisible()) {
  await element.click();
}

// Good
await expect(element).toBeVisible();
await element.click();
```

## Never Use Non-Null Assertions

```typescript
// Bad
const box = await element.boundingBox();
const x = box!.x;

// Good
const box = await element.boundingBox();
if (!box) {
  throw new Error("Unable to locate element bounding box");
}
const x = box.x;
```

## Don't Await Locators (They're Lazy)

```typescript
// Bad
const button = await page.getByTestId("submit");

// Good
const button = page.getByTestId("submit");
await expect(button).toBeVisible();
```

## Use Consistent Assertion Patterns

```typescript
// Bad
expect(await element).toHaveText("text");
expect(await element.isVisible()).toBe(true);

// Good
await expect(element).toHaveText("text");
await expect(element).toBeVisible();
```

## Prefer Semantic Selectors

Priority order:

1. `getByRole()` - Best for accessibility
2. `getByTestId()` - Best for test stability (preferred for this app)
3. `getByText()` - Good for static content
4. `locator()` with data attributes - When above don't work
5. CSS selectors - Last resort

## Test Isolation

- Each test should set up its own state
- Don't depend on test execution order (unless using serial mode intentionally)
- Clean up after tests in `afterEach` or `afterAll`

## Helper Functions

- Leverage existing helpers from `tests/e2e/helpers.ts`
- Create new helpers for repeated workflows
- Keep helpers focused and reusable

## Add Meaningful Error Context

```typescript
// Okay
await expect(element).toBeVisible();

// Better
await expect(element, "Component should appear after loading").toBeVisible();
```

## Test User Behavior, Not Implementation

```typescript
// Bad - implementation detail
await expect(button).toHaveClass("bg-blue-500");

// Good - user-visible behavior
await expect(button).toBeVisible();
await expect(button).toBeEnabled();
await expect(button).toHaveText("Submit");
```
