---
name: tanstack-query
description: TanStack Query v5 patterns for data fetching, mutations, and cache management. Use when writing queries, mutations, or working with server state.
---

# TanStack Query Patterns

This project uses TanStack Query v5 for all server state management.

**Prefer `useQuery` hooks over Context providers for server state.** When you need data from the server, first consider whether a custom `useQuery` hook solves the problem. Only reach for a Context provider when you need to share non-query app-wide state (theme, feature flags, backend config). Wrapping query results in Context bypasses TanStack Query's built-in caching and causes unnecessary re-renders.

## Query Key Conventions

Use **hierarchical array-based keys**. For domains with multiple related queries, use a query key factory:

```typescript
// Query key factory pattern (preferred for grouped queries)
export const SecretsQueryKeys = {
  All: () => ["secrets"] as const,
  Id: (id: string) => ["secrets", id] as const,
} as const;

// Simple keys for standalone queries
queryKey: ["pipeline-run", rootExecutionId];
queryKey: ["execution-details", rootExecutionId];
queryKey: ["component", "hydrate", componentQueryKey];
```

## Query Definition

Define queries **inline in custom hooks** — this project does not use the `queryOptions` helper:

```typescript
export function usePipelineRuns(pipelineName?: string) {
  return useSuspenseQuery({
    queryKey: ["pipelineRuns", pipelineName],
    queryFn: async () => {
      if (!pipelineName) return [];
      const res = await fetchPipelineRuns(pipelineName);
      if (!res) return [];
      return res.runs;
    },
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
```

## Suspense Queries

Use `useSuspenseQuery` for components wrapped in `<SuspenseWrapper>` or error boundaries:

```typescript
export function useHydrateComponentReference(component: ComponentReference) {
  const { data } = useSuspenseQuery({
    queryKey: ["component", "hydrate", getComponentQueryKey(component)],
    staleTime: 1000 * 60 * 60,
    queryFn: () => hydrateComponentReference(component),
  });
  return data;
}
```

## Dependent Queries

Chain queries using the `enabled` option:

```typescript
const { data: rootExecutionId } = useQuery({
  queryKey: ["pipeline-run-execution-id", id],
  queryFn: () =>
    fetchPipelineRun(id, backendUrl).then((res) => res.root_execution_id),
  enabled: !!id && id.length > 0,
});

const { data: executionData } = useQuery({
  enabled: !!rootExecutionId && !!executionDetails,
  queryKey: ["pipeline-run", rootExecutionId],
  queryFn: () => fetchData(rootExecutionId),
});
```

## Mutation Pattern

All mutations follow this structure — invalidate cache on success, toast on error:

```typescript
const { mutate, isPending } = useMutation({
  mutationFn: () => addSecret(secret),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: SecretsQueryKeys.All() });
    onSuccess();
  },
  onError: () => {
    notify("Failed to add secret", "error");
  },
});
```

Multiple invalidations in a single mutation are fine:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["has-component", digest] });
  queryClient.invalidateQueries({ queryKey: ["componentLibrary", "publishedComponents"] });
},
```

## Cache Invalidation Strategy

This project uses **post-mutation invalidation**, not optimistic updates. Do not use `setQueryData` in mutations — invalidate and let the query refetch.

**QueryClient methods used:**

- `queryClient.invalidateQueries()` — primary invalidation
- `queryClient.fetchQuery()` — direct fetch in non-hook contexts (e.g., class-based libraries)
- `queryClient.getQueryData()` — cache reading without triggering refetch
- `queryClient.ensureQueryData()` — fetch-if-not-cached for recursive/dependent data

## Stale Time Guidelines

Match stale time to data volatility:

| Data Type              | Stale Time | Example                                              |
| ---------------------- | ---------- | ---------------------------------------------------- |
| Immutable/rare changes | 24 hours   | Pipeline run metadata, component digests             |
| User profile data      | 30 minutes | User details                                         |
| Semi-stable data       | 1 hour     | Execution details, component hydration               |
| Active lists           | 5 minutes  | Pipeline runs, published components, outdated checks |
| Live/polling data      | 5 seconds  | Logs                                                 |
| Always fresh           | 0          | User components                                      |

Use time constants from `src/utils/constants.ts`: `ONE_MINUTE_IN_MS`, `MINUTES`, `HOURS`, `TWENTY_FOUR_HOURS_IN_MS`.

## Polling with Dynamic Intervals

Use `refetchInterval` with a function for conditional polling:

```typescript
refetchInterval: (data) => {
  if (data instanceof Query) {
    const { state } = data.state.data || {};
    if (!state) return false;
    return isExecutionComplete(stats) ? false : 5000;
  }
  return false;
},
```

## Error Handling

- Use `.catch(() => undefined)` for controlled fallbacks in queryFn
- Use `onError` with toast notifications in mutations
- Create custom error classes for domain-specific errors (e.g., `ComponentHydrationError`)

## File Organization

- **Service functions** (API calls): `src/services/`
- **Query hooks**: `src/hooks/` or co-located in component directories
- **Query key factories**: co-located with the feature (e.g., `types.ts` in the feature folder)
- **Providers using queries**: `src/providers/`
