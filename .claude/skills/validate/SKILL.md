---
name: validate
description: Run validation and testing commands for the project. Use when the user asks to validate, lint, typecheck, or run tests.
disable-model-invocation: true
allowed-tools: Bash(pnpm run *), Bash(pnpm test*)
argument-hint: [test|e2e]
---

# Validate & Test

Run project validation and testing commands.

## Available Commands

- **`pnpm run validate`** - Runs format, lint:fix, typecheck, and knip (use before committing)
- **`pnpm run validate:test`** - Runs validate + unit tests (full validation)
- **`pnpm run test:e2e`** - Runs Playwright E2E tests

## Usage

- `/validate` — Run `pnpm run validate`
- `/validate test` — Run `pnpm run validate:test`
- `/validate e2e` — Run `pnpm run test:e2e`

## Local Development Ports

- **Frontend**: `localhost:3000` (default for `pnpm start`)
- **Backend API**: `localhost:8000`
- **API Docs**: `localhost:8000/docs`
