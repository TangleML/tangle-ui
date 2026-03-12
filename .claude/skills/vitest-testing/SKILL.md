---
name: vitest-testing
description: Vitest unit and component testing patterns. Use when writing unit tests, component tests, or hook tests.
---

# Vitest Testing Patterns

**Focus tests on the component/hook under test.** Assume that dependencies (services, hooks, utilities) are independently tested in their own test files. Only mock what's necessary to isolate the unit under test — don't re-test dependency behavior or create elaborate mock setups for services that aren't the focus of the test.

## Setup

- **Framework**: Vitest with jsdom environment
- **Globals**: `describe`, `it`, `expect` are globally available (no imports needed)
- **DOM matchers**: `@testing-library/jest-dom` is configured in `vitest-setup.js`
- **Component rendering**: `@testing-library/react` with `render`, `screen`, `fireEvent`, `waitFor`
- **No MSW**: Mock functions directly with `vi.mock()` and `vi.fn()`, not HTTP interception

## Test File Location

Tests are **co-located** next to source files:

```
src/utils/searchUtils.ts
src/utils/searchUtils.test.ts

src/hooks/useIOSelectionPersistence.ts
src/hooks/useIOSelectionPersistence.test.ts

src/components/shared/SuspenseWrapper.tsx
src/components/shared/SuspenseWrapper.test.tsx
```

## Utility / Pure Function Tests

```typescript
describe("formatDuration", () => {
  it("formats seconds correctly", () => {
    const start = "2024-01-01T10:00:00.000Z";
    const end = "2024-01-01T10:00:30.000Z";
    expect(formatDuration(start, end)).toBe("30s");
  });
});
```

## Component Tests

Render with providers using a wrapper function:

```typescript
const renderWithProviders = (component: React.ReactElement) => {
  return render(component, {
    wrapper: ({ children }) => (
      <ComponentSpecProvider spec={mockComponentSpec}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ComponentSpecProvider>
    ),
  });
};

it("renders the toolbar", async () => {
  renderWithProviders(<RunToolbar />);
  await waitFor(() => {
    expect(screen.getByTestId("inspect-pipeline-button")).toBeInTheDocument();
  });
});
```

## Hook Tests

Use `renderHook` with a wrapper for hooks that need providers:

```typescript
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

it("should hydrate component", async () => {
  vi.mocked(hydrateComponentReference).mockResolvedValue(mockHydratedRef);

  const { result } = renderHook(
    () => useHydrateComponentReference(mockComponent),
    { wrapper: createWrapper() },
  );

  await waitFor(() => {
    expect(result.current).toEqual(mockHydratedRef);
  });
});
```

Use `act` for state updates in hooks:

```typescript
act(() => {
  result.current.preserveIOSelectionOnSpecChange(initialSpec);
});
expect(mockSetNodes).toHaveBeenCalledWith(expect.any(Function));
```

## Mocking Patterns

### Module mocks with `vi.mock()`

```typescript
vi.mock("@/utils/localforage", () => ({
  componentExistsByUrl: vi.fn(),
  getComponentByUrl: vi.fn(),
  saveComponent: vi.fn(),
}));

// React component mock
vi.mock("@monaco-editor/react", () => ({
  default: ({ defaultValue }: { defaultValue: string }) => (
    <pre data-testid="monaco-mock">{defaultValue}</pre>
  ),
}));

// Provider/context mock
vi.mock("@/providers/ComponentSpecProvider", () => ({
  useComponentSpec: () => ({
    componentSpec: mockSpec,
    setComponentSpec: mockSetComponentSpec,
  }),
}));
```

### Function spies

```typescript
const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
// ... test code
expect(consoleSpy).toHaveBeenCalledWith("Error:", expect.any(Error));
```

### Global mocks

```typescript
const mockFetch = vi.fn();
global.fetch = mockFetch;

mockFetch.mockResolvedValue({
  ok: true,
  text: () => Promise.resolve(yamlContent),
} as Response);
```

### Environment variables

```typescript
vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");
```

## Mock Factories

Create inline helper functions for test data — don't over-abstract:

```typescript
const createMockNode = (
  id: string,
  type: "input" | "output" | "task",
  label: string,
  selected = false,
) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label },
  selected,
});
```

## Setup / Teardown

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup(); // Testing Library cleanup
  queryClient.clear(); // Clear query cache if using QueryClient
  vi.restoreAllMocks();
});
```

## Assertion Patterns

```typescript
// DOM assertions
expect(screen.getByTestId("submit")).toBeInTheDocument();
expect(screen.queryByTestId("hidden")).not.toBeInTheDocument();

// Mock assertions
expect(mockFn).toHaveBeenCalledWith(url);
expect(mockFn).toHaveBeenCalledTimes(1);
expect(mockFn).not.toHaveBeenCalled();

// Partial matching
expect(mockSave).toHaveBeenCalledWith({
  id: expect.stringMatching(/^component-\w+$/),
  createdAt: expect.any(Number),
});
```

## User Interactions

Prefer `fireEvent` for simple interactions in this project:

```typescript
const input = screen.getByLabelText("Name") as HTMLInputElement;
fireEvent.change(input, { target: { value: "NewName" } });
fireEvent.blur(input);
expect(mockCallback).toHaveBeenCalled();
```

## Async Testing

```typescript
// Wait for state updates
await waitFor(() => {
  expect(screen.getByTestId("content")).toBeInTheDocument();
});

// Assert on promises
await expect(promise).resolves.toBe(expectedValue);
```

## npm Scripts

- `npm test` — Run all unit tests once
- `npm run test:coverage` — Run with coverage report
- `npm run validate:test` — Full validate + unit tests
