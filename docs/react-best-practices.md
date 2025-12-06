# React Best Practices

All these practices are documented here since they require some thoughts each time we encounter a relevant situation. They can't easily be enforced through automated rules since they can't be dealt with in absolute. Use your judgement and ask for review whenever unsure.

## Context

Initializing non-primitives during render and passing these values as props or dependencies could lead to

- unnecessary re-renders,
- unmounting and remounting parts of the tree
- and effects to happen more often than intended.

This could impact performance and/or introduce bugs, or even make it harder to implement some features.

```tsx
// ❌ The new callback is considered unstable.
const eventHandler = () => sendEvent({ shopId });

useEffect(() => {
  // Triggers every render
  eventHandler();
}, [eventHandler, shopId]);
```

```tsx
// ✅ Only triggers when the dependency changes.
useEffect(() => {
  sendEvent({ shopId });
}, [shopId]);
```

## Rules of thumb

### Context providers should provide a stable value

If a context value is unstable, every consumer will re-render even though the context value is the same. This often happens when the context contains multiple values wrapped into an object, or passing a custom callback instantiated on render.

### Custom hooks should return stable values

Since a hook can be used anywhere, it should return stable values whenever possible.

### Dependencies should be stable

Passing unstable values as dependencies of `useEffect`, `useCallback`, `useMemo`, etc. _almost_ entirely negates their benefits.

See the decision record about listing dependencies (soon).

### Not everything needs to be memoized

```
// ✅ Unstable props on DOM elements is fine, the impact is unnoticeable.
<button onClick={() => foo(true)}>

// ❌ Passing an unstable prop higher in the tree might impact the whole app.
<App onBar={() => fooBar(false)}>
```

### Keys should be stable

> [Keys](https://reactjs.org/docs/lists-and-keys.html#keys) help React identify which items have changed, are added, or are removed. Keys should be given to the elements inside the array to give the elements a stable identity.

Passing an unstable key would unmount each item, and mount new items every render, which is super inefficient. In addition, it could make it impossible to edit an item and see the changes right away, without trashing the whole list first.

### Never create a component inside of a component

It is an [anti-pattern](https://stackoverflow.com/a/59636503/1218980), but it's not properly documented other than in the Higher-Order Component doc.

> The newly created component will appear in the React tree but it won't retain any state and the lifecycle methods like `componentDidMount`, `componentWillUnmount`, `useEffect` will always get called each render cycle.

### Use functional update when previous state is needed

See the [documentation](https://reactjs.org/docs/hooks-reference.html#functional-updates).

> If the new state is computed using the previous state, you can pass a function to setState. The function will receive the previous value, and return an updated value. Here's an example of a counter component that uses both forms of setState:
>
> ```tsx
> function Counter({ initialCount }) {
>   const [count, setCount] = useState(initialCount);
>   return (
>     <>
>       Count: {count}
>       <button onClick={() => setCount(initialCount)}>Reset</button>
>       <button onClick={() => setCount((prevCount) => prevCount - 1)}>
>         Decrement
>       </button>
>       <button onClick={() => setCount((prevCount) => prevCount + 1)}>
>         Increment
>       </button>
>     </>
>   );
> }
> ```

In the previous example, if multiple increments would happen at the same time, the state would reflect the right value. Without functional update, the state would get incremented based on a stale value of the state, which, in the end, would only increment the state once.

## File Colocation - Keep Related Code Together

When deciding where to place a new component, hook, or helper function, follow the principle of colocation: **place code as close as possible to where it's used**. Start specific and move to general only when truly needed.

### Why Colocation Matters

- **Better discoverability**: Related code lives together, making it easier to understand and maintain
- **Easier refactoring**: Changes are localized, reducing the risk of breaking unrelated features
- **Clearer dependencies**: It's obvious what code is using what
- **Prevents premature abstraction**: Avoid creating "shared" code that's only used in one place

### The Colocation Hierarchy

When creating new code, follow this hierarchy (from most specific to most general):

1. **Same file** - If only used once, keep it in the same file (unless the file becomes too large for readability)
2. **Sibling file in same folder** - If used by multiple files in that folder
3. **Parent folder** - If used by multiple child folders
4. **Feature/domain folder** - If used across a feature boundary
5. **Shared/common folder** - Only if truly used across multiple unrelated features

### Examples

#### Components

```tsx
// ❌ BAD: Creating a "shared" component that's only used in one place
// src/components/shared/SubmitButton.tsx
export const SubmitButton = ({ onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled}>
    Submit
  </button>
);

// src/components/Editor/PipelineEditor.tsx
import { SubmitButton } from "../shared/SubmitButton";
// Only used here...
```

```tsx
// ✅ GOOD: Keep the component where it's used
// src/components/Editor/PipelineEditor.tsx
const SubmitButton = ({ onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled}>
    Submit
  </button>
);

export const PipelineEditor = () => {
  // Use SubmitButton directly in the same file
  return <SubmitButton onClick={handleSubmit} />;
};
```

```tsx
// ✅ GOOD: Move to sibling file when used by multiple components in the same feature
// src/components/Editor/components/SubmitButton.tsx
export const SubmitButton = ({ onClick, disabled }) => {
  // Component implementation
};

// src/components/Editor/PipelineEditor.tsx
import { SubmitButton } from "./components/SubmitButton";

// src/components/Editor/PipelineDetails.tsx
import { SubmitButton } from "./components/SubmitButton";
```

#### Hooks

```tsx
// ❌ BAD: Creating a generic hook in /hooks when it's feature-specific
// src/hooks/usePipelineValidation.ts
export const usePipelineValidation = () => {
  // Pipeline-specific validation logic
};

// src/components/Editor/PipelineEditor.tsx
import { usePipelineValidation } from "../../hooks/usePipelineValidation";
// Only the Editor feature uses this...
```

```tsx
// ✅ GOOD: Keep feature-specific hooks with the feature
// src/components/Editor/hooks/usePipelineValidation.ts
export const usePipelineValidation = () => {
  // Pipeline-specific validation logic
};

// src/components/Editor/PipelineEditor.tsx
import { usePipelineValidation } from "./hooks/usePipelineValidation";
```

#### Helper Functions

```tsx
// ❌ BAD: Putting very specific logic in a general utils folder
// src/utils/formatters.ts
export const formatPipelineNodeLabel = (node) => {
  // Very specific to pipeline nodes...
  return `${node.type}: ${node.name}`;
};

// src/components/ReactFlow/TaskNode/TaskNode.tsx
import { formatPipelineNodeLabel } from "@/utils/formatters";
```

```tsx
// ✅ GOOD: Keep specific helpers close to where they're used
// src/components/ReactFlow/TaskNode/utils.ts
export const formatNodeLabel = (node) => {
  return `${node.type}: ${node.name}`;
};

// src/components/ReactFlow/TaskNode/TaskNode.tsx
import { formatNodeLabel } from "./utils";
```

### When to Move Up the Hierarchy

Only move code to a more general location when:

1. **It's actually used in multiple unrelated places** - Not just "might be used someday"
2. **It's truly generic** - The abstraction makes sense without the specific context
3. **It has stabilized** - The API isn't changing frequently

```tsx
// ✅ GOOD: This date formatter is truly generic and used app-wide
// src/utils/date.ts
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-US").format(date);
};

// ✅ GOOD: This button is used across many unrelated features
// src/components/ui/button.tsx
export const Button = ({ variant, size, children, ...props }) => {
  // Generic button implementation
};
```

### Testing and Colocation

Apply the same principle to test files:

```tsx
// ✅ GOOD: Test files live next to the code they test
// src/components/Editor/
//   PipelineEditor.tsx
//   PipelineEditor.test.tsx
//   utils.ts
//   utils.test.ts
```

### Red Flags to Watch For

- A "shared" or "common" folder with code that's only imported from one place
- Deep import paths with lots of `../` navigation
- "Utils" or "helpers" files that contain very domain-specific logic
- Components in shared folders that have props specific to one feature

## Async Data Handling with Suspense

Our application uses React Suspense for handling async data loading, providing a consistent and elegant way to manage loading states, errors, and data fetching. This section covers the key patterns and best practices.

### Using `useSuspenseQuery()`

`useSuspenseQuery()` from TanStack Query is the preferred method for fetching async data. It integrates seamlessly with React Suspense and provides automatic caching, refetching, and error handling.

```tsx
// ✅ GOOD: Using useSuspenseQuery for data fetching
import { useSuspenseQuery } from "@tanstack/react-query";

export function useHydrateComponentReference(component: ComponentReference) {
  const { data: componentRef } = useSuspenseQuery({
    queryKey: ["component", "hydrate", component.digest ?? component.url],
    queryFn: () => hydrateComponentReference(component),
    staleTime: 1000 * 60 * 60 * 1, // 1 hour
    retryOnMount: true,
  });

  return componentRef;
}
```

#### Key Benefits:

- **Automatic Suspense integration**: The component will suspend while data is loading
- **Built-in error handling**: Errors are caught by error boundaries
- **Caching**: Data is cached and shared across components
- **No loading state management**: Loading states are handled by Suspense boundaries

#### Best Practices for `useSuspenseQuery`:

1. **Use descriptive query keys**: Include all dependencies that affect the query
2. **Set appropriate `staleTime`**: Prevent unnecessary refetches for stable data
3. **Keep query functions pure**: They should only fetch data, not cause side effects

```tsx
// ✅ GOOD: Well-structured query with proper configuration
const { data } = useSuspenseQuery({
  queryKey: ["user", userId, "posts", { status: "published" }],
  queryFn: () => fetchUserPosts(userId, { status: "published" }),
  staleTime: 1000 * 60 * 5, // 5 minutes for user-specific data
});
```

### Using `withSuspenseWrapper()` HOC

The `withSuspenseWrapper()` Higher-Order Component provides a consistent way to wrap components that use suspense queries. It combines Suspense boundaries, error boundaries, and skeleton loading states.

```tsx
// ✅ GOOD: Component that fetches data using useSuspenseQuery
const ComponentDetailsDialogContent = ({ componentRef }: Props) => {
  // This will suspend the component
  const hydratedComponent = useHydrateComponentReference(componentRef);

  return (
    <Dialog>
      <ComponentDetails component={hydratedComponent} />
    </Dialog>
  );
};

// Create a skeleton that matches the component's layout
const ComponentDetailsSkeleton = () => {
  return (
    <BlockStack gap="3">
      <InlineStack gap="2">
        <Skeleton size="lg" shape="button" />
        <Skeleton size="lg" shape="button" />
      </InlineStack>
      <BlockStack gap="2">
        <Skeleton size="full" />
        <Skeleton size="half" />
      </BlockStack>
    </BlockStack>
  );
};

// Export the wrapped component
export const ComponentDetailsDialog = withSuspenseWrapper(
  ComponentDetailsDialogContent,
  ComponentDetailsSkeleton,
);
```

#### When to Use `withSuspenseWrapper()`:

1. **Components that fetch data**: Any component using `useSuspenseQuery`
2. **Feature boundaries**: Wrap at logical feature boundaries to localize loading states
3. **Dialog/Modal content**: Provides smooth loading transitions for async content

#### When NOT to Use:

1. **Already within a Suspense boundary**: Don't nest unnecessarily
2. **Synchronous components**: Only needed for components that suspend
3. **Tiny components**: Consider wrapping at a higher level for small components

### Creating Effective Skeleton Components

Skeletons provide visual feedback during loading states and should match the layout of the actual content to prevent layout shift.

#### Skeleton Best Practices:

1. **Match the actual layout**: Skeletons should have the same structure as loaded content

```tsx
// ✅ GOOD: Skeleton matches the component structure
const SearchResultsSkeleton = () => {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 border rounded">
          <Skeleton size="lg" className="mb-2" />
          <Skeleton size="sm" className="mb-1" />
          <Skeleton size="full" />
        </div>
      ))}
    </div>
  );
};
```

2. **Use consistent skeleton components**: Leverage the shared `Skeleton` component

```tsx
import { Skeleton } from "@/components/ui/skeleton";

// ✅ GOOD: Using the standard Skeleton component with variants
<Skeleton size="lg" shape="button" />
<Skeleton size="full" />
<Skeleton size="half" />
```

3. **Keep skeletons simple**: They should be lightweight and render quickly

```tsx
// ❌ BAD: Overly complex skeleton with animations and logic
const ComplexSkeleton = () => {
  const [animationState, setAnimationState] = useState(0);
  useEffect(() => {
    // Unnecessary complexity
  }, []);

  return <div>...</div>;
};

// ✅ GOOD: Simple, declarative skeleton
const SimpleSkeleton = () => (
  <div className="space-y-2">
    <Skeleton size="lg" />
    <Skeleton size="full" />
  </div>
);
```

### Error Handling in Suspense Boundaries

The `withSuspenseWrapper()` HOC includes error boundary handling with retry capabilities:

```tsx
// The wrapper automatically provides error UI with retry
export const MyComponent = withSuspenseWrapper(
  MyComponentContent,
  MyComponentSkeleton,
);

// Users will see a friendly error message with a "Try Again" button
// that will reset the error boundary and retry the failed queries
```

### Composition Patterns

#### Pattern 1: Page-Level Suspense

```tsx
// ✅ GOOD: Wrap at page level for coordinated loading
const PageContent = () => {
  const userData = useUserData();
  const permissions = usePermissions();

  return (
    <PageLayout>
      <UserProfile data={userData} />
      <PermissionsPanel permissions={permissions} />
    </PageLayout>
  );
};

export const Page = withSuspenseWrapper(PageContent, PageSkeleton);
```

#### Pattern 2: Progressive Loading

```tsx
// ✅ GOOD: Multiple suspense boundaries for progressive loading
const Dashboard = () => {
  return (
    <div>
      {/* Critical content loads first */}
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>

      {/* Secondary content can load independently */}
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>

      {/* Non-critical content loads last */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations />
      </Suspense>
    </div>
  );
};
```

#### Pattern 3: Optimistic Updates with Suspense

```tsx
// ✅ GOOD: Combine mutations with suspense queries
const EditableComponent = () => {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["component", id],
    queryFn: fetchComponent,
  });

  const mutation = useMutation({
    mutationFn: updateComponent,
    onSuccess: () => {
      // Invalidate to trigger suspense refetch
      queryClient.invalidateQueries({ queryKey: ["component", id] });
    },
  });

  return <ComponentEditor data={data} onSave={mutation.mutate} />;
};
```

### Common Pitfalls to Avoid

1. **Don't catch suspense promises manually**

```tsx
// ❌ BAD: Trying to handle suspense manually
try {
  const data = useSuspenseQuery(...);
} catch (promise) {
  // Don't do this!
}

// ✅ GOOD: Let Suspense boundaries handle it
const data = useSuspenseQuery(...);
```

2. **Don't mix loading patterns**

```tsx
// ❌ BAD: Mixing suspense with manual loading states
const Component = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { data } = useSuspenseQuery(...); // This suspends!

  if (isLoading) return <Spinner />; // Never reached
  return <div>{data}</div>;
};

// ✅ GOOD: Use suspense consistently
const Component = () => {
  const { data } = useSuspenseQuery(...);
  return <div>{data}</div>;
};
```

3. **Don't create skeletons dynamically**

```tsx
// ❌ BAD: Creating skeleton component inside wrapper call
export const Component = withSuspenseWrapper(
  ComponentContent,
  () => (
    <div>
      <Skeleton />
    </div>
  ), // New component every render!
);

// ✅ GOOD: Define skeleton as a stable component
const ComponentSkeleton = () => (
  <div>
    <Skeleton />
  </div>
);
export const Component = withSuspenseWrapper(
  ComponentContent,
  ComponentSkeleton,
);
```

### Testing Components with Suspense

When testing components that use suspense:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>{component}</Suspense>
    </QueryClientProvider>,
  );
};

// In your test
test("loads and displays data", async () => {
  renderWithProviders(<MyComponent />);

  // Wait for suspense to resolve
  await waitFor(() => {
    expect(screen.getByText("Expected Content")).toBeInTheDocument();
  });
});
```

## UI Primitives and Visual Consistency

Our application provides a comprehensive set of UI primitives that should be used instead of plain HTML elements. This approach ensures visual consistency, better maintainability, and a more predictable UI.

### Why Use UI Primitives?

Using UI primitives instead of plain HTML elements with inline Tailwind classes provides several benefits:

1. **Visual Consistency**: Predefined variants ensure consistent spacing, colors, and typography across the app
2. **Maintainability**: Changes to design tokens update all components automatically
3. **Type Safety**: TypeScript support for variant props catches errors at compile time
4. **Reduced Bundle Size**: Reusing variant classes is more efficient than repeating Tailwind utilities
5. **Better Developer Experience**: Semantic props are clearer than utility class strings

### Core UI Primitives

#### Layout Components: `BlockStack` and `InlineStack`

Use these instead of `div` with flexbox utilities:

```tsx
// ❌ BAD: Plain div with Tailwind classes
<div className="flex flex-col gap-4 items-center justify-between">
  <div className="flex gap-2 items-center">
    <span>Label</span>
    <button>Action</button>
  </div>
</div>

// ✅ GOOD: Using layout primitives
<BlockStack gap="4" align="center" inlineAlign="space-between">
  <InlineStack gap="2" blockAlign="center">
    <Text>Label</Text>
    <Button>Action</Button>
  </InlineStack>
</BlockStack>
```

Available props for layout components:

- **BlockStack**: `gap`, `align` (horizontal), `inlineAlign` (vertical distribution)
- **InlineStack**: `gap`, `align` (horizontal distribution), `blockAlign` (vertical), `wrap`

#### Typography: `Text`, `Paragraph`, `Heading`

Use these instead of `span`, `p`, `h1-h6`:

```tsx
// ❌ BAD: Plain HTML elements with custom styles
<span className="text-sm text-gray-600 font-medium">Status</span>
<p className="text-xs text-red-500">Error message</p>
<h2 className="text-lg font-bold">Section Title</h2>

// ✅ GOOD: Using typography primitives
<Text size="sm" tone="subdued" weight="medium">Status</Text>
<Paragraph size="xs" tone="critical">Error message</Paragraph>
<Heading level={2}>Section Title</Heading>
```

Typography variants:

- **size**: `xs`, `sm`, `md`, `lg`, `xl`
- **tone**: `default`, `subdued`, `critical`, `info`, `success`, `warning`
- **weight**: `regular`, `medium`, `semibold`, `bold`
- **font**: `default`, `mono`

#### Buttons with Variants

Use the `Button` component with its predefined variants:

```tsx
// ❌ BAD: Custom button styling
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Submit
</button>

// ✅ GOOD: Using Button with variants
<Button variant="default" size="default">
  Submit
</Button>
<Button variant="destructive" size="sm">
  Delete
</Button>
<Button variant="ghost" size="icon">
  <Icon name="Settings" />
</Button>
```

Button variants:

- **variant**: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- **size**: `default`, `sm`, `lg`, `icon`, `xs`, `min`

### Creating Custom Components with CVA

When creating new components, use CVA (class-variance-authority) to define variants:

```tsx
// ✅ GOOD: Custom component using CVA
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground shadow-sm",
  {
    variants: {
      padding: {
        none: "",
        sm: "p-2",
        md: "p-4",
        lg: "p-6",
      },
      variant: {
        default: "border-border",
        elevated: "shadow-md",
        outlined: "border-2",
      },
    },
    defaultVariants: {
      padding: "md",
      variant: "default",
    },
  },
);

interface CardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, padding, variant, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ padding, variant }), className)}
      {...props}
    />
  );
}
```

### Composition Patterns

#### Pattern 1: Building Complex Layouts

```tsx
// ✅ GOOD: Composing UI primitives for complex layouts
export function ComponentCard({ component }: Props) {
  return (
    <BlockStack gap="2" className="border rounded-md p-4">
      <InlineStack align="space-between" blockAlign="center">
        <BlockStack gap="1">
          <Heading level={3}>{component.name}</Heading>
          <Text size="sm" tone="subdued">
            {component.description}
          </Text>
        </BlockStack>
        <Button variant="ghost" size="icon">
          <Icon name="MoreVertical" />
        </Button>
      </InlineStack>

      <InlineStack gap="2">
        <Badge variant="secondary">v{component.version}</Badge>
        <Text size="xs" tone="subdued">
          Updated {formatDate(component.updatedAt)}
        </Text>
      </InlineStack>
    </BlockStack>
  );
}
```

#### Pattern 2: Conditional Styling

```tsx
// ❌ BAD: Inline conditional Tailwind classes
<div className={`p-4 rounded ${
  isError ? 'bg-red-50 border-red-200' :
  isWarning ? 'bg-yellow-50 border-yellow-200' :
  'bg-gray-50 border-gray-200'
}`}>
  {message}
</div>

// ✅ BETTER: Use `cn` utility for conditional classes
<div className={cn(
  "p-4 rounded",
  isError && "bg-red-50 border-red-200",
  isWarning && "bg-yellow-50 border-yellow-200",
  !isError && !isWarning && "bg-gray-50 border-gray-200"
)}>
  {message}
</div>

// ✅ BEST: Use variant props
<Alert variant={isError ? "destructive" : isWarning ? "warning" : "default"}>
  <AlertDescription>{message}</AlertDescription>
</Alert>
```

### When Custom Classes Are Acceptable

While UI primitives should be preferred, custom classes are acceptable in these cases:

1. **One-off positioning adjustments**:

```tsx
// ✅ OK: Specific positioning that doesn't warrant a variant
<BlockStack className="absolute top-4 right-4">
  <CloseButton />
</BlockStack>
```

2. **Animation and transitions**:

```tsx
// ✅ OK: Custom animations
<BlockStack className="transition-opacity duration-200 hover:opacity-80">
  {content}
</BlockStack>
```

3. **Grid layouts** (when BlockStack/InlineStack don't suffice):

```tsx
// ✅ OK: Grid layout for complex arrangements
<div className="grid grid-cols-3 gap-4">
  {items.map((item) => (
    <Card key={item.id}>{item.content}</Card>
  ))}
</div>
```

### Common Anti-Patterns to Avoid

#### 1. Overusing Plain HTML Elements

```tsx
// ❌ BAD: Plain divs everywhere
function ComponentList() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-lg font-bold">Components</div>
      <div className="flex flex-col gap-2">
        {components.map((c) => (
          <div className="p-2 border rounded">{c.name}</div>
        ))}
      </div>
    </div>
  );
}

// ✅ GOOD: Using UI primitives
function ComponentList() {
  return (
    <BlockStack gap="4" className="p-4">
      <Heading level={2}>Components</Heading>
      <BlockStack gap="2">
        {components.map((c) => (
          <Card key={c.id} padding="sm">
            <Text>{c.name}</Text>
          </Card>
        ))}
      </BlockStack>
    </BlockStack>
  );
}
```

#### 2. Mixing Paradigms

```tsx
// ❌ BAD: Mixing UI primitives with utility-heavy divs
<BlockStack gap="2">
  <Text>Title</Text>
  <div className="flex gap-2 items-center p-2 bg-gray-100 rounded">
    <span className="text-sm">Status</span>
  </div>
</BlockStack>

// ✅ GOOD: Consistent use of primitives
<BlockStack gap="2">
  <Text>Title</Text>
  <InlineStack gap="2" blockAlign="center" className="p-2 bg-gray-100 rounded">
    <Text size="sm">Status</Text>
  </InlineStack>
</BlockStack>
```

#### 3. Recreating Existing Variants

```tsx
// ❌ BAD: Custom styles that duplicate existing variants
<Text className="text-red-600 text-sm font-medium">
  Error: Invalid input
</Text>

// ✅ GOOD: Use existing tone variants
<Text tone="critical" size="sm" weight="medium">
  Error: Invalid input
</Text>
```

### Migration Strategy

When refactoring existing code:

1. **Start with new features**: Apply UI primitives to all new code
2. **Refactor during feature work**: Update components you're already modifying
3. **Create tickets for tech debt**: Track remaining migrations
4. **Don't mix in the same PR**: Avoid refactoring unrelated components

Example refactoring:

```tsx
// Before
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    <img src={icon} className="w-6 h-6" />
    <span className="font-medium">{title}</span>
  </div>
  <button className="text-sm text-blue-600 hover:text-blue-800">
    View Details
  </button>
</div>

// After
<InlineStack align="space-between" blockAlign="center" className="mb-4">
  <InlineStack gap="2" blockAlign="center">
    <Icon name={icon} size="lg" />
    <Text weight="medium">{title}</Text>
  </InlineStack>
  <Button variant="link" size="sm">
    View Details
  </Button>
</InlineStack>
```

### Testing UI Primitives

When testing components that use UI primitives:

```tsx
// ✅ GOOD: Test behavior, not implementation details
test("displays error message", () => {
  render(<Alert message="Error occurred" variant="destructive" />);

  // Don't test for specific classes
  // ❌ expect(screen.getByRole("alert")).toHaveClass("bg-red-50");

  // Test for content and semantics
  // ✅
  expect(screen.getByRole("alert")).toHaveTextContent("Error occurred");
});
```

## References

- [Mastering React’s Stable Values](https://shopify.engineering/master-reacts-stable-values)
- [Why Did You Render](https://github.com/welldone-software/why-did-you-render) lib to help identify unnecessary renders
- [When to useMemo and useCallback](https://kentcdodds.com/blog/usememo-and-usecallback) article
- [Mastering React’s Stable Values - 2022](https://shopify.engineering/master-reacts-stable-values)
