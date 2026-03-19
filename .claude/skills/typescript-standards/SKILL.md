---
name: typescript-standards
description: TypeScript coding standards for this project. Use when writing TypeScript code, defining types, or working with type safety.
---

# TypeScript Standards

## Core Rules

- Use strict TypeScript with proper typing
- Prefer explicit types over `any` (only use `any` when absolutely necessary)
- Use `interface` for object shapes, `type` for unions/primitives
- Follow existing patterns for type definitions in `src/types/`

## Avoid Unsafe Type Casting

Don't use type assertions (`as`) unless absolutely necessary. Instead prefer:

- Type guards and runtime validation
- Proper typing from the source
- Union types and type narrowing
- Schema validation libraries (e.g., zod) for external data

```typescript
// Bad
const something: string = myjson as string;

// Good - use type guards or validate the data
function isString(value: unknown): value is string {
  return typeof value === "string";
}
```

## API & Data Types

- Use the generated API client in `src/api/`
- **Prefer domain types**: Use types from `src/utils/componentSpec.ts`, `src/types/`, etc. for core business logic
- **Use generated API types**: Only use `src/api/types.gen.ts` when directly interfacing with APIs or when domain types don't exist
- Follow existing service patterns in `src/services/`
- Use proper error handling with try/catch

## Naming Conventions

- Components: PascalCase
- Files: PascalCase for components, camelCase for utilities
- Variables/functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase
- Directories: Follow the existing convention in the surrounding directory. The codebase uses both camelCase and PascalCase for folders — match what's already there
