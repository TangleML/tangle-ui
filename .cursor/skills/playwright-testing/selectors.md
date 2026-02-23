# Selectors Catalog

Complete reference of `data-testid` and other selectors used in Pipeline Studio E2E tests.

## React Flow Elements

| Selector                                                      | Description               |
| ------------------------------------------------------------- | ------------------------- |
| `[data-testid="rf__wrapper"]`                                 | Main React Flow container |
| `[data-testid="rf__node-task_{name}"]`                        | Task node by name         |
| `[data-testid="rf__edge-{source}_{output}-{target}_{input}"]` | Edge connection           |
| `.react-flow__viewport`                                       | Canvas viewport           |
| `.react-flow__pane`                                           | Clickable canvas area     |
| `.react-flow__minimap`                                        | MiniMap component         |
| `.react-flow__controls`                                       | Zoom controls container   |
| `.react-flow__controls-zoomin`                                | Zoom in button            |
| `.react-flow__controls-zoomout`                               | Zoom out button           |
| `.react-flow__controls-fitview`                               | Fit to view button        |

## Component Library

| Selector                                   | Description                |
| ------------------------------------------ | -------------------------- |
| `[data-folder-name="{name}"]`              | Folder container by name   |
| `[data-testid="component-item"]`           | Component item (all)       |
| `[data-component-name="{name}"]`           | Component by specific name |
| `[data-testid="search-input"]`             | Search input field         |
| `[data-testid="search-results-header"]`    | Search results header      |
| `[data-testid="search-results-container"]` | Search results container   |
| `[data-testid="search-filter-counter"]`    | Filter count badge         |
| `[data-testid="favorite-star"]`            | Favorite toggle button     |
| `[data-testid="info-icon-button"]`         | Component info button      |

## Node Handles & Connections

| Selector                                    | Description                 |
| ------------------------------------------- | --------------------------- |
| `[data-handleid="input_{name}"]`            | Input pin by name           |
| `[data-handleid="output_{name}"]`           | Output pin by name          |
| `[data-testid="input-handle-{name}"]`       | Input handle container      |
| `[data-testid="output-handle-{name}"]`      | Output handle container     |
| `[data-testid="input-handle-value-{name}"]` | Input handle value display  |
| `[data-testid="input-connection-{name}"]`   | Input connection indicator  |
| `[data-testid="output-connection-{name}"]`  | Output connection indicator |

## Context Panels

| Selector                                  | Description                 |
| ----------------------------------------- | --------------------------- |
| `[data-testid="context-panel-container"]` | Panel container             |
| `[data-context-panel="pipeline-details"]` | Pipeline details panel      |
| `[data-context-panel="task-overview"]`    | Task overview panel         |
| `[data-testid="arguments-section"]`       | Arguments section container |

## Arguments Editor

| Selector                                            | Description                        |
| --------------------------------------------------- | ---------------------------------- |
| `[data-testid="argument-input-{name}"]`             | Argument input field by name       |
| `[data-testid="argument-use-secret-button-{name}"]` | Use Secret button for argument     |
| `[data-testid="secret-argument-display"]`           | Secret value display               |
| `[data-secret-name="{name}"]`                       | Element with secret name attribute |

## Secrets Management

| Selector                                      | Description                         |
| --------------------------------------------- | ----------------------------------- |
| `[data-testid="manage-secrets-button"]`       | Manage Secrets button in top bar    |
| `[data-testid="manage-secrets-dialog"]`       | Manage Secrets dialog               |
| `[data-testid="add-secret-button"]`           | Add Secret button                   |
| `[data-testid="secret-name-input"]`           | Secret name input field             |
| `[data-testid="secret-value-input"]`          | Secret value input field            |
| `[data-testid="add-secret-submit-button"]`    | Add Secret submit button            |
| `[data-testid="update-secret-submit-button"]` | Update Secret submit button         |
| `[data-testid="secret-form-cancel-button"]`   | Secret form cancel button           |
| `[data-testid="secret-item"]`                 | Secret item in list                 |
| `[data-testid="secret-edit-button"]`          | Secret edit button                  |
| `[data-testid="secret-remove-button"]`        | Secret remove button                |
| `[data-testid="secrets-empty-state"]`         | Empty state when no secrets         |
| `[data-testid="select-secret-dialog"]`        | Select Secret dialog                |
| `[data-testid="select-secret-list"]`          | Secret selection list               |
| `[data-testid="selectable-secret-item"]`      | Selectable secret item              |
| `[data-testid="select-secret-add-button"]`    | Add button in Select Secret dialog  |
| `[data-testid="select-secret-empty-state"]`   | Empty state in Select Secret dialog |

## Submit Run

| Selector                                    | Description               |
| ------------------------------------------- | ------------------------- |
| `[data-testid="submit-run-button"]`         | Submit Run button         |
| `[data-testid="run-with-arguments-button"]` | Run with arguments button |

## Dialogs & UI

| Selector                                      | Description              |
| --------------------------------------------- | ------------------------ |
| `[data-testid="new-pipeline-button"]`         | New pipeline button      |
| `[data-testid="import-component-button"]`     | Import component button  |
| `[data-testid="import-component-dialog"]`     | Import dialog            |
| `[data-testid="component-details-dialog"]`    | Component details dialog |
| `[data-testid="personal-preferences-button"]` | Preferences button       |
| `[data-testid="personal-preferences-dialog"]` | Preferences dialog       |
| `[data-testid="python-editor"]`               | Python code editor       |
| `[role="alertdialog"]`                        | Confirmation dialogs     |
| `[data-slot="dialog-header"]`                 | Dialog header            |
| `[data-slot="dialog-close"]`                  | Dialog close button      |

## Usage Examples

### Locating a Task Node

```typescript
const node = page.locator('[data-testid="rf__node-task_MyComponent"]');
await expect(node).toBeVisible();
```

### Locating an Edge

```typescript
const edge = page.locator(
  '[data-testid="rf__edge-SourceNode_output-TargetNode_input"]',
);
await expect(edge).toBeVisible();
```

### Working with Component Library

```typescript
const folder = page.locator('[data-folder-name="Quick start"]');
const component = folder.locator('[data-component-name="Chicago Taxi"]');
await component.click();
```

### Working with Handles

```typescript
const inputPin = node.locator('[data-handleid="input_data"]');
const outputPin = node.locator('[data-handleid="output_result"]');

// Check connection state
await expect(inputPin).toHaveAttribute("data-invalid", "false");
```

### Working with Dialogs

```typescript
const dialog = page.getByTestId("component-details-dialog");
await expect(dialog).toBeVisible();

// Close using the standard close button
await dialog.locator('[data-slot="dialog-close"]').click();
await expect(dialog).toBeHidden();
```
