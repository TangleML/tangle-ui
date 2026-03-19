---
name: react-patterns
description: React and React Compiler patterns for this project. Use when writing React components, hooks, providers, or working with React Compiler compatibility.
---

# React Patterns

## Core Rules

- Use functional components with hooks exclusively (no class components)
- Use proper dependency arrays in useEffect
- Follow the existing component structure
- Use React 19 features and patterns
- **Import modules from React**: `import module from react`. Do not use inline `React.[module]`

## Component Structure

```typescript
// ComponentName/ComponentName.tsx — import directly, no index.ts barrel
interface ComponentNameProps {
  // props
}

export const ComponentName = ({ }: ComponentNameProps) => {
  // component logic
  return (
    // JSX
  );
};
```

## Custom Hooks

- Prefix with `use`
- Return objects for multiple values, not arrays
- Use proper TypeScript return types
- Follow existing patterns in `src/hooks/`

## Provider Pattern

```typescript
const Context = createContext<ContextType | null>(null);

export const Provider = ({ children }: { children: ReactNode }) => {
  // provider logic
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useContext = () => {
  const context = useContext(Context);
  if (!context) throw new Error('useContext must be used within Provider');
  return context;
};
```

## State Management

- Use Tanstack Query for server state
- Use Tanstack Router for routing
- Use React hooks for local component state
- Use Context providers for app-wide state (see existing providers in `src/providers/`)
- **Use `useRequiredContext`** to simplify context usage and avoid null checks

## React Compiler

This project uses the React Compiler for automatic memoization. Files/directories are incrementally adopted in `react-compiler.config.js`.

### Writing React Compiler Compatible Code

**For new files**, ensure they follow React Compiler rules from the start:

1. **Don't mutate values during render**

   ```typescript
   // Bad - mutating during render
   const items = props.items;
   items.push(newItem);

   // Good - create new reference
   const items = [...props.items, newItem];
   ```

2. **Don't read/write refs during render**

   ```typescript
   // Bad - reading ref during render
   const value = myRef.current;
   return <div>{value}</div>;

   // Good - read refs in effects or callbacks
   useEffect(() => {
     const value = myRef.current;
   }, []);
   ```

3. **Follow Rules of Hooks strictly** - no conditional hooks, no hooks in loops, proper dependency arrays

4. **Avoid patterns the compiler can't optimize**
   - Don't spread props with `{...props}` unnecessarily
   - Avoid dynamic property access on objects when possible
   - Keep component logic predictable

### Adding Files to React Compiler

When a file is added to `react-compiler.config.js`:

- Remove unnecessary `useCallback` and `useMemo` (compiler handles this)
- Verify no compiler violations with `npm run validate`
- Test the component still works correctly
- **Consolidate entries by folder** when all files in a directory are compiler-enabled (e.g., use `/path/to/folder` instead of listing each file individually)

### React Compiler Config Structure

Files are organized by cleanup effort in `react-compiler.config.js`:

- Top section: Already enabled directories/files
- Middle: Ready to enable (0 useCallback/useMemo)
- Bottom (commented): Need cleanup before enabling

## Performance

- **Do not use `useMemo`, `useCallback`, or `memo` manually** — the React Compiler handles memoization automatically
- If you encounter existing `useMemo`/`useCallback`/`memo` in a file, remove them when the file is enabled in `react-compiler.config.js`
- Lazy load heavy components when possible
- Follow existing patterns for optimization
