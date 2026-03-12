---
name: tanstack-router
description: TanStack Router patterns for routing, navigation, search params, and layouts. Use when creating routes, navigating, or working with URL state.
---

# TanStack Router Patterns

This project uses **code-based routing** (not file-based) with TanStack Router v1.

## Route Definitions

All routes are defined in `src/routes/router.ts` using `createRoute` and assembled into a tree with `addChildren`:

```typescript
const mainLayout = createRoute({
  id: "main-layout",
  getParentRoute: () => rootRoute,
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => mainLayout,
  path: APP_ROUTES.HOME,
  component: Editor,
});

// Assemble tree
const appRouteTree = mainLayout.addChildren([
  indexRoute,
  quickStartRoute,
  settingsRouteTree,
  editorRoute,
]);
```

## Route Path Constants

Use the `APP_ROUTES` constant object for all route paths — never hardcode path strings:

```typescript
export const APP_ROUTES = {
  HOME: "/",
  QUICK_START: "/quick-start",
  PIPELINE_EDITOR: `${EDITOR_PATH}/$name`,
  RUN_DETAIL: `${RUNS_BASE_PATH}/$id`,
  RUNS: RUNS_BASE_PATH,
  SETTINGS: "/settings",
} as const;
```

## Navigation

**useNavigate hook:**

```typescript
const navigate = useNavigate();
navigate({ to: `${APP_ROUTES.RUNS}/${runId}` });
```

**Handle Ctrl/Cmd+Click for new tabs:**

```typescript
const handleRowClick = (e: MouseEvent<HTMLElement>) => {
  if (e.ctrlKey || e.metaKey) {
    window.open(clickThroughUrl, "_blank");
    return;
  }
  navigate({ to: clickThroughUrl });
};
```

**Link component with active state:**

```typescript
import { Link } from "@tanstack/react-router";

<Link
  to={item.to}
  replace
  activeProps={{ className: "is-active" }}
>
  {({ isActive }) => (
    <Button variant="ghost" className={cn("w-full", isActive && "bg-accent")}>
      <Icon name={item.icon} size="sm" />
      <Text size="sm">{item.label}</Text>
    </Button>
  )}
</Link>
```

## Data Fetching

This project uses **TanStack Query for data fetching**, not route loaders. Routes do not define `loader` functions — use query hooks in components instead.

`beforeLoad` is only used for redirects and simple param extraction:

```typescript
const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: APP_ROUTES.SETTINGS_BACKEND });
  },
});
```

## Search Params

Use `useSearch` with type casting and manual validation (not Zod):

```typescript
type RunSectionSearch = { page_token?: string; filter?: string };
const search = useSearch({ strict: false }) as RunSectionSearch;
const filters = parseFilterParam(search.filter);
```

For complex search param management, see the `useRunSearchParams` hook in `src/hooks/useRunSearchParams.ts` which provides `setFilter`, `clearFilters`, `hasActiveFilters`, etc.

Validate search params with **type guards**, not Zod:

```typescript
function isValidAnnotationFilter(value: unknown): value is AnnotationFilter {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    (value.value === undefined || typeof value.value === "string")
  );
}
```

## Route Params

```typescript
const { id, subgraphExecutionId } = useParams();
```

## Router Hooks

| Hook                           | Use Case                                          |
| ------------------------------ | ------------------------------------------------- |
| `useNavigate()`                | Programmatic navigation                           |
| `useParams()`                  | Route parameters (`$id`, `$name`)                 |
| `useSearch({ strict: false })` | Search/query params                               |
| `useLocation()`                | Current pathname                                  |
| `useRouter()`                  | Router instance (history, back navigation)        |
| `useRouterState()`             | Advanced state (resolved location, pending state) |

## Layout Nesting

Layouts use `<Outlet />` for child routes. The root layout (`RootLayout`) wraps providers:

```
rootRoute
├── mainLayout (RootLayout: BackendProvider > ComponentSpecProvider > AppMenu + Outlet)
│   ├── indexRoute
│   ├── settingsLayoutRoute (SettingsLayout: sidebar + Outlet)
│   │   ├── settingsBackendRoute
│   │   └── secretsRouteTree
│   ├── editorRoute
│   └── runDetailRoute
└── Auth callback routes (no layout)
```

## Router Config

```typescript
export const router = createRouter({
  routeTree: rootRouteTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  history,
  basepath: IS_GITHUB_PAGES ? "" : basepath,
});
```

- `defaultPreload: "intent"` — preloads routes on hover/focus
- `scrollRestoration: true` — restores scroll position on back navigation
