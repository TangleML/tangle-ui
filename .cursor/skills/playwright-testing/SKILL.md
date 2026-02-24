---
name: playwright-testing
description: Write and debug Playwright E2E tests for Pipeline Studio. Use when creating E2E tests, debugging test failures, exploring selectors, or adding data-testid attributes to components.
---

# Playwright E2E Testing

Guidance for writing and debugging Playwright E2E tests for the Pipeline Studio application.

## Project Context

### Environment

- **Frontend**: `http://localhost:3000` (Vite dev server)
- **Backend API**: `http://localhost:8000`
- **Test Directory**: `tests/e2e/`
- **Helpers**: `tests/e2e/helpers.ts`

### Application Overview

Pipeline Studio is a React Flow-based ML pipeline editor with:

- **Canvas**: Drag-and-drop flow editor for building pipelines
- **Component Library**: Hierarchical folders of reusable ML components
- **Context Panels**: Side panels for pipeline/task details
- **Node Connections**: Input/output handles for data flow

## Quick Probing with Playwright CLI

### Interactive Browser Inspection

```bash
# Open app with Playwright codegen for locator discovery
npx playwright codegen http://localhost:3000

# Record actions and generate test code
npx playwright codegen http://localhost:3000 --output tests/e2e/recorded.spec.ts
```

### Running Tests

```bash
npm run test:e2e              # Run all E2E tests (headless)
npm run test:e2e:ui           # Playwright UI (interactive debugging)
npm run test:e2e:headed       # Headed mode (see the browser)
npx playwright test file.spec.ts        # Specific file
npx playwright test -g "test name"      # Specific test by name
npx playwright test --debug             # Debug mode with step-through
npx playwright test --trace on          # Trace viewer on failure
```

### Locator Exploration

```bash
# Open Playwright Inspector to explore locators
npx playwright open http://localhost:3000

# In codegen: Click "Pick locator" → Click element → Copy locator
```

## Agent Debugging with playwright-cli

Use `playwright-cli` for interactive debugging and probing. It's designed for coding agents - token-efficient and provides element refs without loading full accessibility trees.

**Install globally:**

```bash
npm install -g @playwright/cli@latest
```

### Core Debugging Workflow

```bash
# 1. Open browser and navigate (headed mode to see what's happening)
playwright-cli open http://localhost:3000 --headed

# 2. Take snapshot to get element refs
playwright-cli snapshot
# Output: [Snapshot](.playwright-cli/page-*.yml) with element refs like e1, e2, e3...

# 3. Interact using refs from snapshot
playwright-cli click e15              # Click element ref
playwright-cli type "search query"    # Type into focused element
playwright-cli fill e23 "value"       # Fill specific element
playwright-cli press Enter            # Press keyboard key

# 4. Inspect state
playwright-cli console                # View console messages
playwright-cli network                # View network requests
playwright-cli localstorage-list      # View localStorage
playwright-cli cookie-list            # View cookies

# 5. Close when done
playwright-cli close
```

### Session Management

Use sessions to keep browser state between commands:

```bash
# Use named session for this project
playwright-cli -s=tangle open http://localhost:3000 --headed

# All subsequent commands use same session
playwright-cli -s=tangle snapshot
playwright-cli -s=tangle click e5
playwright-cli -s=tangle console

# List all sessions
playwright-cli list

# Close specific session
playwright-cli -s=tangle close

# Close all sessions
playwright-cli close-all
```

### Key Commands Reference

| Command                         | Description                         |
| ------------------------------- | ----------------------------------- |
| `open [url] --headed`           | Open browser (visible)              |
| `snapshot`                      | Get page snapshot with element refs |
| `click <ref>`                   | Click element by ref                |
| `fill <ref> <text>`             | Fill input with text                |
| `type <text>`                   | Type into focused element           |
| `press <key>`                   | Press keyboard key                  |
| `hover <ref>`                   | Hover over element                  |
| `select <ref> <value>`          | Select dropdown option              |
| `check <ref>` / `uncheck <ref>` | Toggle checkbox                     |
| `console [level]`               | View console messages               |
| `network`                       | View network requests               |
| `screenshot [ref]`              | Take screenshot                     |
| `eval <code> [ref]`             | Evaluate JS on page/element         |

### Debugging Test Failures

When a test fails, reproduce the failure interactively:

```bash
# Start session
playwright-cli -s=debug open http://localhost:3000 --headed

# Follow the test steps manually
playwright-cli -s=debug snapshot
# Look at snapshot, find the element ref that should be clicked

playwright-cli -s=debug click e12
playwright-cli -s=debug snapshot
# Check if state changed as expected

# Inspect what went wrong
playwright-cli -s=debug console --level=error
playwright-cli -s=debug network
```

### Visual Dashboard

Monitor all running browser sessions:

```bash
playwright-cli show
```

Opens a dashboard showing:

- All active sessions with live screencast
- Click to zoom into any session
- Take over mouse/keyboard control

### Trace Analysis (for test failures)

```bash
npx playwright test failing-test.spec.ts --trace on
npx playwright show-trace test-results/*/trace.zip
```

## Test Patterns

### Standard Test (Parallel)

```typescript
import { expect, test } from "@playwright/test";
import { createNewPipeline } from "./helpers";

test.describe("Feature Name", () => {
  test("should do something specific", async ({ page }) => {
    await createNewPipeline(page);
    await page.getByTestId("some-button").click();
    await expect(page.getByTestId("result")).toBeVisible();
  });
});
```

### Serial Tests (Shared State)

Use for tests that share expensive setup (e.g., library loading):

```typescript
import { expect, type Page, test } from "@playwright/test";
import { createNewPipeline } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Component Library", () => {
  let page: Page;

  const testResourceName = "TEST_RESOURCE";

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await createNewPipeline(page);
  });

  test.afterAll(async () => {
    // Always cleanup in afterAll - runs even if tests fail
    await cleanupTestResource(page, testResourceName);
    await page.close();
  });

  test("test one", async () => {
    // Use shared `page`
  });
});
```

### Test Cleanup

**Always use `afterAll` for cleanup, not separate tests.** If cleanup is a test and an earlier test fails, the system ends up in a corrupted state.

```typescript
// ❌ Bad: Cleanup as a test - won't run if earlier tests fail
test("cleanup: remove test data", async () => {
  await removeTestSecret(page);
});

// ✅ Good: Cleanup in afterAll - always runs regardless of test failures
test.afterAll(async () => {
  await cleanupTestSecret(page, testSecretName);
  await page.close();
});
```

**Cleanup should fail loudly, not silently.** Silent failures hide problems and make debugging harder.

```typescript
// ❌ Bad: Silently swallowing errors
async function cleanup(page: Page): Promise<void> {
  try {
    await removeItem(page);
  } catch {
    // Silent failure - debugging nightmare
  }
}

// ✅ Good: Fail with clear error messages
async function cleanupTestSecret(
  page: Page,
  secretName: string,
): Promise<void> {
  const dialog = await openManageSecretsDialog(page);
  const secretItem = dialog.locator(
    `[data-testid="secret-item"][data-secret-name="${secretName}"]`,
  );

  await expect(
    secretItem,
    "Test secret should exist for cleanup",
  ).toBeVisible();
  await secretItem.getByTestId("secret-remove-button").click();
  await expect(secretItem, "Test secret should be removed").toBeHidden();

  await closeDialog(page);
}
```

## Helper Functions (from `tests/e2e/helpers.ts`)

### Pipeline Setup

```typescript
await createNewPipeline(page); // Navigate home and create new pipeline
```

### Canvas Locators & Interactions

```typescript
// Locators (synchronous - no await)
const canvas = locateFlowCanvas(page); // Main React Flow wrapper
const viewport = locateFlowViewport(page); // Canvas viewport
const pane = locateFlowPane(page); // Clickable canvas area

// Node locator
const node = locateNodeByName(page, "Chicago Taxi Trips dataset");

// Canvas actions
await clickOnCanvas(page, 400, 300); // Click at coordinates
await panCanvas(page, deltaX, deltaY); // Pan the canvas
await zoomIn(page); // Zoom in
await zoomOut(page); // Zoom out
await fitToView(page); // Fit all nodes in view
```

### Component Library

```typescript
const folder = await openComponentLibFolder(page, "Quick start");
const component = locateComponentInFolder(folder, "Chicago Taxi Trips dataset");

// Complete workflow: drag from library to canvas
const node = await dropComponentFromLibraryOnCanvas(
  page,
  "Quick start", // Folder name
  "Chicago Taxi Trips dataset", // Component name
  { targetPosition: { x: 400, y: 300 } }, // Optional drag options
);

await removeComponentFromCanvas(page, "Chicago Taxi Trips dataset");
```

### Context Panels

```typescript
const container = locateContextPanelContainer(page); // Panel container
const panel = locateContextPanel(page, "pipeline-details"); // Specific panel

await waitForContextPanel(page, "pipeline-details");
await waitForContextPanel(page, "task-overview");
```

### Search Assertions

```typescript
await assertSearchState(page, {
  searchTerm: "CSV",
  searchFilterCount: "2", // Optional: filter badge count
  searchResultsCount: "5", // Optional: expected results, or "*" for any
});
```

### Debugging Tips

```typescript
// Pause for interactive debugging (opens Playwright Inspector)
await page.pause();

// Log bounding boxes for positioning issues
const nodeBox = await node.boundingBox();
console.log("Node position:", nodeBox);

// Screenshot for visual debugging
await page.screenshot({ path: "debug-screenshot.png" });
```

## Key Selectors

For the complete selectors catalog, see [selectors.md](selectors.md).

### Most Common Selectors

| Selector                                  | Description               |
| ----------------------------------------- | ------------------------- |
| `[data-testid="rf__wrapper"]`             | Main React Flow container |
| `[data-testid="rf__node-task_{name}"]`    | Task node by name         |
| `[data-folder-name="{name}"]`             | Component library folder  |
| `[data-testid="search-input"]`            | Search input field        |
| `[data-testid="context-panel-container"]` | Panel container           |
| `[data-handleid="input_{name}"]`          | Input pin by name         |
| `[data-handleid="output_{name}"]`         | Output pin by name        |

### Sticky Note (FlexNode) Selectors

| Selector                                      | Description                   |
| --------------------------------------------- | ----------------------------- |
| `.react-flow__node-flex`                      | Sticky note nodes             |
| `[data-testid="sticky-note-sidebar-item"]`    | Sidebar drag item             |
| `[data-testid="color-picker-popover"]`        | Color picker popover          |
| `[data-testid="color-picker-trigger-{name}"]` | Color picker trigger button   |
| `[data-testid="color-preset-{hex}"]`          | Color preset (e.g., `c8e6c9`) |
| `[data-testid="color-preset-transparent"]`    | Transparent color preset      |
| `[data-testid="stacking-controls"]`           | Z-index control buttons       |
| `[data-testid="stacking-move-forward"]`       | Move forward button           |
| `[data-testid="stacking-bring-to-front"]`     | Bring to front button         |
| `[data-testid="selection-toolbar"]`           | Multi-select toolbar          |
| `[data-testid="selection-duplicate-nodes"]`   | Duplicate button in toolbar   |

### Validation UI Selectors

| Selector                                   | Description                                       |
| ------------------------------------------ | ------------------------------------------------- |
| `[data-testid="info-box-success"]`         | Success validation state (no issues)              |
| `[data-testid="info-box-error"]`           | Error validation state                            |
| `[data-testid="info-box-warning"]`         | Warning validation state                          |
| `[data-testid="info-box-title"]`           | Validation title text (e.g., "2 errors detected") |
| `[data-testid="validation-group"]`         | Collapsible validation group                      |
| `[data-testid="validation-group-trigger"]` | Button to expand/collapse group                   |
| `[data-testid="validation-issue"]`         | Individual validation issue button                |
| `[data-issue-level="error"]`               | Data attribute on issue (error/warning)           |

### IO Node Selectors

| Selector                                | Description                    |
| --------------------------------------- | ------------------------------ |
| `[data-testid="io-node-input-{name}"]`  | Input node by input name       |
| `[data-testid="io-node-output-{name}"]` | Output node by output name     |
| `[data-testid="input-value-field"]`     | Input value textarea in editor |

## Adding data-testid Attributes

### When to Add

- Interactive elements (buttons, inputs, toggles)
- Dynamic containers (lists, grids, panels)
- Key UI landmarks (headers, navigation)
- Elements used in assertions

### When NOT to Add

- Purely decorative elements
- Static text that won't be asserted
- Elements already identifiable by role/label

### Naming Conventions

```typescript
data-testid="submit-button"           // Good: kebab-case, descriptive
data-testid="SubmitButton"            // Bad: not kebab-case
data-testid="btn1"                    // Bad: not descriptive

// Include context for repeated patterns
data-testid="input-handle-{inputName}"
data-testid="rf__node-task_{taskName}"

// Use prefixes for related groups
data-testid="search-input"
data-testid="search-results-header"
```

### Adding to Components

```tsx
<Button data-testid="save-pipeline-button">Save</Button>

<div data-testid={`input-handle-${input.name}`}>{input.value}</div>

<div
  data-testid="component-item"
  data-component-name={component.name}
>
  {component.name}
</div>
```

## Active Helper Opportunity Scanning

**IMPORTANT**: While writing or reviewing E2E tests, actively scan for helper opportunities. Don't just write tests—look for patterns that should be extracted.

### Scan Triggers (Check After Every Test)

After writing each test, ask:

1. **Did I write similar code in another test?** → Extract helper
2. **Is this action sequence reusable?** → Extract helper
3. **Would another test author need to figure this out again?** → Extract helper

### Patterns That MUST Become Helpers

| Pattern                       | Example                                                               | Action                                        |
| ----------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| **3+ similar locator chains** | `page.getByTestId("dialog").getByRole("tab", { name: "X" })` repeated | Create `locateDialogTab(page, tabName)`       |
| **Multi-step workflows**      | Open modal → fill form → submit → verify                              | Create `submitFormInModal(page, formData)`    |
| **Wait + interact combos**    | `await expect(x).toBeVisible(); await x.click();`                     | Create `waitAndClick(page, locator)`          |
| **Complex assertions**        | Multiple related expects                                              | Create `assertComponentState(page, expected)` |
| **Setup sequences**           | Navigate → wait → configure                                           | Create `setupFeatureTest(page, config)`       |

### Active Scanning Checklist

While writing tests, flag these for extraction:

```markdown
□ Repeated locator patterns (same getByTestId/getByRole chains)
□ Similar click sequences (open → interact → close)
□ Assertion groups that verify related state
□ Navigation + wait patterns
□ Form fill patterns
□ Drag-and-drop sequences
□ Modal/dialog interaction patterns
□ Table/list row interactions
```

### When Writing a New Test File

1. **Before writing**: Check `helpers.ts` for existing helpers
2. **While writing**: Note repeated patterns in comments: `// TODO: extract to helper`
3. **After writing**: Review TODOs and extract helpers that appear 2+ times

### Helper Extraction Template

```typescript
/**
 * [Brief description of what this helper does]
 * @param page - Playwright page object
 * @param [otherParams] - Description
 * @returns [What it returns - element locators callers will need]
 * @throws Error if [failure conditions]
 */
export async function helperName(
  page: Page,
  param1: string,
  options: { option1?: boolean } = {},
): Promise<ReturnType> {
  const element = page.getByTestId("element");
  const box = await element.boundingBox();

  if (!box) {
    throw new Error("Unable to locate element bounding box");
  }

  return result;
}
```

**Return values callers will need.** When a helper opens a dialog or locates an element, return it so callers don't need to re-locate:

```typescript
// ❌ Bad: Caller must re-locate the dialog
async function openDialog(page: Page): Promise<void> {
  await page.getByTestId("open-button").click();
  const dialog = page.getByTestId("my-dialog");
  await expect(dialog).toBeVisible();
}

// ✅ Good: Return the dialog for further interactions
async function openDialog(page: Page) {
  await page.getByTestId("open-button").click();
  const dialog = page.getByTestId("my-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

// Usage - no need to re-locate
const dialog = await openDialog(page);
await dialog.getByTestId("submit").click();
```

### Proposing New Helpers

When you identify a helper opportunity, propose it:

```markdown
**Helper Opportunity Identified**

**Pattern**: [Describe the repeated pattern]
**Occurrences**: [Where it appears - file:line]
**Proposed helper**:

- Name: `doSomething(page, params)`
- Purpose: [What it abstracts]
- Returns: [What it returns]

Should I extract this to `helpers.ts`?
```

## Best Practices

### NEVER Do

```typescript
// ❌ Hard-coded timeouts
await page.waitForTimeout(200);

// ❌ Non-null assertions
const box = await element.boundingBox();
const x = box!.x; // Crashes if null

// ❌ Await locators (they're lazy)
const button = await page.getByTestId("submit");

// ❌ Test implementation details
await expect(button).toHaveClass("bg-blue-500");

// ❌ Conditional visibility checks
if (await element.isVisible()) {
  await element.click();
}
```

### ALWAYS Do

```typescript
// ✅ Use auto-waiting assertions
await expect(element).toBeVisible();
await element.click();

// ✅ Explicit null checks with errors
const box = await element.boundingBox();
if (!box) {
  throw new Error("Unable to locate element bounding box");
}

// ✅ Locators are synchronous
const button = page.getByTestId("submit");
await expect(button).toBeVisible();

// ✅ Test user-visible behavior
await expect(button).toBeVisible();
await expect(button).toBeEnabled();
await expect(button).toHaveText("Submit");

// ✅ Use steps for reliable drag operations
await page.mouse.move(targetX, targetY, { steps: 10 });
```

### Selector Priority

1. `getByTestId()` - Best for this app (stable, explicit)
2. `getByRole()` - Good for accessibility
3. `getByText()` - Good for static content
4. `locator()` with data attributes - When above don't work
5. CSS selectors - Last resort

### Error Context

```typescript
await expect(
  element,
  "Component should appear after loading completes",
).toBeVisible();
```

## Common Workflows

### Adding a Component to Canvas

```typescript
await createNewPipeline(page);
const node = await dropComponentFromLibraryOnCanvas(
  page,
  "Quick start",
  "Chicago Taxi Trips dataset",
);
await expect(node).toBeVisible();
```

### Connecting Two Nodes

```typescript
const nodeA = await dropComponentFromLibraryOnCanvas(
  page,
  "folder",
  "ComponentA",
);
const nodeB = await dropComponentFromLibraryOnCanvas(
  page,
  "folder",
  "ComponentB",
  {
    targetPosition: { x: 500, y: 300 },
  },
);

await fitToView(page);

const outputPin = nodeA.locator('[data-handleid="output_OutputName"]');
const inputPin = nodeB.locator('[data-handleid="input_InputName"]');

await outputPin.hover();
await page.mouse.down();
await inputPin.hover();
await page.mouse.up();

// Verify edge created
const edge = page.locator(
  '[data-testid="rf__edge-ComponentA_OutputName-ComponentB_InputName"]',
);
await expect(edge).toBeVisible();
```

### Testing Dialogs

```typescript
await page.getByTestId("trigger-button").click();
const dialog = page.getByTestId("my-dialog");
await expect(dialog).toBeVisible();

await dialog.getByRole("tab", { name: "Settings" }).click();
await dialog.getByTestId("some-input").fill("value");

await dialog.locator('[data-slot="dialog-close"]').click();
await expect(dialog).toBeHidden();
```

### Testing Search

```typescript
await page.getByTestId("search-input").fill("query");
await expect(page.getByTestId("search-results-container")).toBeVisible();

await assertSearchState(page, {
  searchTerm: "query",
  searchResultsCount: "5",
});

await page.getByTestId("search-input").clear();
await expect(page.getByTestId("search-results-header")).toBeHidden();
```

### Node Connection Testing

```typescript
// Verify connection state before and after
await expect(inputPin).toHaveAttribute("data-invalid", "true"); // Required

await outputPin.hover();
await page.mouse.down();
await inputPin.hover();
await page.mouse.up();

await expect(inputPin).toHaveAttribute("data-invalid", "false");
```

## React Flow Gotchas

### Escape Key Deselects Nodes

Pressing `Escape` in React Flow deselects the currently selected node. This causes context panels to switch from node editor to pipeline view.

**When you WANT to deselect** (e.g., to check pipeline-level state like validation):

```typescript
// ✅ Good: Use Escape to reliably deselect and show pipeline-details
await page.keyboard.press("Escape");
await waitForContextPanel(page, "pipeline-details");

// ❌ Bad: Clicking on canvas pane can accidentally hit a node
await page.locator(".react-flow__pane").click({ position: { x: 100, y: 100 } });
// May not deselect if coordinates happen to land on a node
```

**When you DON'T want to deselect** (e.g., closing a popover while keeping node selected):

```typescript
// ❌ Bad: Escape closes popover but deselects node
await presetColor.click();
await page.keyboard.press("Escape");
// Node is now deselected, context panel shows pipeline view

// ✅ Good: Click the node to close popover while keeping selection
await presetColor.click();
await stickyNote.click();
// Popover closes, node stays selected
```

### Highlight vs Select

Clicking validation issues or using `fitNodeIntoView` **highlights** nodes (orange border) but does NOT **select** them. The context panel won't change.

```typescript
// Clicking validation issue highlights the node, doesn't select it
await validationIssue.click();
await expect(node).toBeInViewport(); // ✅ Node is in viewport
// await expect(node).toHaveClass(/\bselected\b/); // ❌ Won't have selected class
// Context panel still shows pipeline-details, not task-overview
```

### Creating IO Nodes with Meta+Drag (Ghost Node)

Holding `Meta` (Cmd on Mac) while dragging from an input/output handle creates a new Input/Output node:

```typescript
await page.keyboard.down("Meta");

await inputHandle.hover();
await page.mouse.down();
await page.mouse.move(targetX, targetY, { steps: 10 });
await page.mouse.up();

await page.keyboard.up("Meta");

// Verify the new input node was created
const inputNode = page.getByTestId("io-node-input-{handleName}");
await expect(inputNode).toBeVisible();
```

### Box Selection Needs Canvas Focus

For Shift+drag box selection to work, the canvas must have focus first:

```typescript
// ✅ Good: Click canvas first to ensure keyboard events are captured
await clickOnCanvas(page);

await page.keyboard.down("Shift");
await page.mouse.move(startX, startY);
await page.mouse.down();
await page.mouse.move(endX, endY, { steps: 10 }); // Use steps for reliability
await page.mouse.up();
await page.keyboard.up("Shift");
```

### Node Position via Transform

React Flow positions nodes using CSS `transform`, not absolute coordinates. Use `style.transform` to verify node movement:

```typescript
// ✅ Good: Compare transform values
const initialTransform = await node.evaluate((el) => el.style.transform);
// ... drag node ...
const newTransform = await node.evaluate((el) => el.style.transform);
expect(newTransform).not.toBe(initialTransform);

// ❌ Bad: boundingBox coordinates may not change as expected
const initialBox = await node.boundingBox();
// ... drag node ...
const newBox = await node.boundingBox();
// Box coordinates affected by canvas zoom/pan, may be misleading
```

## Fragile Selectors to Avoid

### Inline Style Selectors

```typescript
// ❌ Bad: Color values can change, hard to read
const greenPreset = popover.locator(
  '[style*="background-color: rgb(200, 230, 201)"]',
);

// ✅ Good: Add data-testid to the component
const greenPreset = page.getByTestId("color-preset-c8e6c9");
```

### Third-Party Library Internals

```typescript
// ❌ Bad: Radix UI internal attribute, may change in updates
const popover = page.locator("[data-radix-popper-content-wrapper]");

// ✅ Good: Add data-testid to PopoverContent in the component
const popover = page.getByTestId("color-picker-popover");
```

## Validation Checklist

**Always run before committing:**

```bash
npm run validate  # Runs format, lint:fix, typecheck, and knip
```

This catches:

- Import ordering issues
- TypeScript errors
- Unused dependencies
- Code formatting issues
