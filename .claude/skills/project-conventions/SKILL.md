---
name: project-conventions
description: Project conventions for Tangle-UI including file structure, imports, code quality, and general rules. Use when writing new code, creating files, or organizing imports.
---

# Project Conventions

## Project Overview

React + TypeScript application for building and running ML pipelines using drag and drop. Uses Vite, TailwindCSS v4, shadcn/ui, React Flow, and Monaco Editor.

## File Structure & Imports

- Use absolute imports with `@/` prefix for src directory
- Follow existing folder structure:
  - `src/components/` for all React components
  - `src/hooks/` for custom hooks
  - `src/types/` for TypeScript definitions
  - `src/utils/` for utility functions
  - `src/services/` for API and business logic
- **Import order**: external packages -> internal modules -> relative imports
- Use simple-import-sort rules (already configured in ESLint)
- Do not use barrel exports

## Code Quality

- Follow ESLint rules (configured in eslint.config.js)
- Use Prettier for formatting
- Write tests using Vitest for unit tests, Playwright for E2E
- Use descriptive variable and function names
- Add JSDoc comments for complex functions
- Prefer early returns to reduce nesting

## Comments & Documentation

- Use JSDoc for public APIs
- Add comments for complex business logic
- **Explain "why" not "what" in comments**
- Keep comments up to date with code changes
- Avoid writing redundant comments for functions and variables that are self-explanatory

## Error Handling

- Use proper error boundaries
- Handle async errors with try/catch
- Use toast notifications for user-facing errors
- Log errors appropriately

## React Flow Specific

- Use `@xyflow/react` for flow diagrams
- Follow existing node types and edge patterns
- Keep flow state management consistent with existing patterns
- Use proper node and edge typing

## Specific Project Patterns

- Use Monaco Editor for code editing features
- Use localforage for client-side storage
- Follow existing authentication patterns
- Use proper task node and pipeline handling patterns
- Follow the existing component library structure
- **Do not modify componentSpec structure** without express permission

## Don't Do

- Don't use CSS-in-JS or styled-components
- Don't use inline styling (`style={styles}`) except where strictly necessary
- Don't use relative imports for `@/components/ui`
- Don't create new global state without good reason
- Don't bypass existing abstractions without discussion

## Planning & Documentation

When asked to create planning documents, architecture decisions, or investigation notes:

- **Always save to `.local/`** - This directory is gitignored for local-only files
- Use descriptive filenames: `.local/feature-name-planning.md`, `.local/bug-investigation.md`

## Optional "While We're Here" Cleanup

After completing a code generation task, scan the surrounding area for small, low-risk improvements. **Only offer** if ALL conditions are met:

1. **Small scope**: Affects < 30 lines of code
2. **Low risk**: Purely cosmetic or minor refactoring (not logic changes)
3. **Same file**: In a file you already modified
4. **Clear benefit**: Improves readability, removes dead code, or fixes obvious issues

Don't be naggy — only offer once per task, and only if genuinely worthwhile.
