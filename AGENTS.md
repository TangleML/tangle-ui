# Agent instructions

Follow `CLAUDE.md` and the applicable conventions in `.claude/skills/`.

## API SDK mismatches

- Verify the target backend's OpenAPI document before changing a request. Confirm
  the HTTP method, request body, response fields, and operation ID, then use the
  generated SDK and types instead of handwritten API contracts.
- Regeneration requires explicit authorization for the generated files or command,
  unless the user has already provided it. Do not hand-edit generated files.
- Check generator and client compatibility first. The current external
  `@hey-api/client-fetch@0.13.1` works with `@hey-api/openapi-ts@0.72.2`; generator
  `0.99.0` expects incompatible client types. Recheck this pairing when versions
  change. Preserve the existing shared client's initialization and interceptors.
- Use `pnpm run generate-api` when its generator, client, and input are compatible.
  For a focused update, use a temporary config and a compatible generator without
  adding a permanent package script or feature-specific generation config.
- Limit generation to the required public operations and their referenced schemas.
  Inspect the output for unrelated routes and deployment or authentication details.
  Keep dependency and lockfile changes out of a focused SDK update unless authorized.

For example, to refresh pipeline search against a matching backend running on
`http://localhost:8000`, temporarily create `openapi-ts.local.config.ts` at the
repository root:

```ts
export default {
  input: {
    path: "http://localhost:8000/openapi.json",
    filters: {
      operations: { include: ["POST /api/pipelines/search"] },
      orphans: false,
    },
  },
  output: { path: "src/api/remotePipelines", clean: false },
  plugins: [
    { name: "@hey-api/client-fetch", bundle: false },
    "@hey-api/typescript",
    { name: "@hey-api/sdk", client: false },
  ],
};
```

Run the authorized command from the repository root, then remove the temporary
config before committing:

```sh
pnpm --package=@hey-api/openapi-ts@0.72.2 dlx openapi-ts --file openapi-ts.local.config.ts --no-log-file
```

Pass the existing `client` from `@/api/client.gen` and the configured `baseUrl` to
the generated operation. Run the relevant service and UI tests, type checking,
lint, formatting checks, and Knip before pushing the generated SDK and its callers.
