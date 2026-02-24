# Agent Debugging with playwright-cli

`playwright-cli` is a CLI designed for coding agents to interact with browsers. It's more token-efficient than MCP because it avoids loading large tool schemas and accessibility trees into context.

**GitHub**: https://github.com/microsoft/playwright-cli

## Installation

```bash
npm install -g @playwright/cli@latest
playwright-cli --help
```

## Complete Command Reference

### Core Commands

```bash
playwright-cli open [url]               # Open browser, optionally navigate
playwright-cli goto <url>               # Navigate to URL
playwright-cli close                    # Close the page
playwright-cli type <text>              # Type into focused element
playwright-cli click <ref> [button]     # Click element by ref
playwright-cli dblclick <ref>           # Double click
playwright-cli fill <ref> <text>        # Fill input element
playwright-cli drag <start> <end>       # Drag and drop
playwright-cli hover <ref>              # Hover over element
playwright-cli select <ref> <value>     # Select dropdown option
playwright-cli upload <file>            # Upload file
playwright-cli check <ref>              # Check checkbox/radio
playwright-cli uncheck <ref>            # Uncheck checkbox
playwright-cli snapshot                 # Get page snapshot with refs
playwright-cli eval <code> [ref]        # Evaluate JavaScript
playwright-cli dialog-accept [prompt]   # Accept dialog
playwright-cli dialog-dismiss           # Dismiss dialog
playwright-cli resize <w> <h>           # Resize browser window
```

### Navigation

```bash
playwright-cli go-back                  # Go back
playwright-cli go-forward               # Go forward
playwright-cli reload                   # Reload page
```

### Keyboard

```bash
playwright-cli press <key>              # Press key (Enter, Tab, ArrowDown, etc.)
playwright-cli keydown <key>            # Key down
playwright-cli keyup <key>              # Key up
```

### Mouse

```bash
playwright-cli mousemove <x> <y>        # Move mouse
playwright-cli mousedown [button]       # Mouse down
playwright-cli mouseup [button]         # Mouse up
playwright-cli mousewheel <dx> <dy>     # Scroll
```

### Screenshots & Output

```bash
playwright-cli screenshot [ref]         # Screenshot page or element
playwright-cli screenshot --filename=f  # Save with specific filename
playwright-cli pdf                      # Save page as PDF
```

### Tabs

```bash
playwright-cli tab-list                 # List all tabs
playwright-cli tab-new [url]            # Create new tab
playwright-cli tab-close [index]        # Close tab
playwright-cli tab-select <index>       # Select tab
```

### DevTools Inspection

```bash
playwright-cli console [level]          # View console messages (error/warning/info/debug)
playwright-cli network                  # View all network requests
playwright-cli tracing-start            # Start trace recording
playwright-cli tracing-stop             # Stop trace recording
playwright-cli video-start              # Start video recording
playwright-cli video-stop [filename]    # Stop video recording
```

### Storage

```bash
# Cookies
playwright-cli cookie-list [--domain]   # List cookies
playwright-cli cookie-get <name>        # Get cookie
playwright-cli cookie-set <name> <val>  # Set cookie
playwright-cli cookie-delete <name>     # Delete cookie
playwright-cli cookie-clear             # Clear all cookies

# LocalStorage
playwright-cli localstorage-list        # List entries
playwright-cli localstorage-get <key>   # Get value
playwright-cli localstorage-set <k> <v> # Set value
playwright-cli localstorage-delete <k>  # Delete entry
playwright-cli localstorage-clear       # Clear all

# SessionStorage
playwright-cli sessionstorage-list      # List entries
playwright-cli sessionstorage-get <k>   # Get value
playwright-cli sessionstorage-set <k> <v> # Set value
playwright-cli sessionstorage-delete <k>  # Delete entry
playwright-cli sessionstorage-clear     # Clear all

# State persistence
playwright-cli state-save [filename]    # Save storage state
playwright-cli state-load <filename>    # Load storage state
```

### Network Mocking

```bash
playwright-cli route <pattern> [opts]   # Mock network requests
playwright-cli route-list               # List active routes
playwright-cli unroute [pattern]        # Remove route(s)
```

### Session Management

```bash
playwright-cli -s=name <cmd>            # Run command in named session
playwright-cli -s=name close            # Close named session
playwright-cli -s=name delete-data      # Delete session data
playwright-cli list                     # List all sessions
playwright-cli close-all                # Close all browsers
playwright-cli kill-all                 # Force kill all browsers
playwright-cli show                     # Open visual dashboard
```

## Understanding Snapshots

After each command, `playwright-cli` outputs a snapshot with element refs:

```
### Page
- Page URL: http://localhost:3000/
- Page Title: Pipeline Studio

### Snapshot
[Snapshot](.playwright-cli/page-2026-02-14T19-22-42-679Z.yml)
```

The snapshot YAML contains element refs like `e1`, `e2`, `e3`... Use these refs in subsequent commands:

```bash
playwright-cli snapshot
# Output shows: e15 is the search input, e23 is submit button

playwright-cli fill e15 "search query"
playwright-cli click e23
```

## Debugging Workflow Example

```bash
# 1. Start debugging session
playwright-cli -s=debug open http://localhost:3000 --headed

# 2. Get initial state
playwright-cli -s=debug snapshot

# 3. Navigate to the problematic area
playwright-cli -s=debug click e5  # Click "New Pipeline"
playwright-cli -s=debug snapshot

# 4. Check if component library loaded
playwright-cli -s=debug console --level=error
playwright-cli -s=debug network

# 5. Try to reproduce the test failure
playwright-cli -s=debug fill e12 "Chicago"
playwright-cli -s=debug snapshot

# 6. Inspect element state via eval
playwright-cli -s=debug eval "document.querySelector('[data-testid=\"search-input\"]').value"

# 7. Check localStorage for app state
playwright-cli -s=debug localstorage-list

# 8. Cleanup
playwright-cli -s=debug close
```

## Configuration

Create `.playwright/cli.config.json` for project-specific settings:

```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": {
      "headless": false
    }
  },
  "testIdAttribute": "data-testid",
  "outputDir": ".local/playwright-cli",
  "timeouts": {
    "action": 5000,
    "navigation": 30000
  }
}
```

## Environment Variables

| Variable                           | Description                                |
| ---------------------------------- | ------------------------------------------ |
| `PLAYWRIGHT_CLI_SESSION`           | Default session name                       |
| `PLAYWRIGHT_MCP_BROWSER`           | Browser to use (chrome, firefox, webkit)   |
| `PLAYWRIGHT_MCP_HEADLESS`          | Run headless                               |
| `PLAYWRIGHT_MCP_VIEWPORT_SIZE`     | Viewport size (e.g., "1280x720")           |
| `PLAYWRIGHT_MCP_TEST_ID_ATTRIBUTE` | Test ID attribute (default: "data-testid") |
