---
name: open-source
description: Open source guidelines for Tangle-UI. Use when writing user-facing text, UI copy, error messages, banners, documentation, or any content visible to users.
---

# Open Source Guidelines

Tangle-UI is an **open source project**. All code, UI copy, and documentation must be vendor-neutral and usable by anyone — not just Shopify employees.

## Do Not Include

- **Company-specific references**: No mentions of Shopify, internal teams, internal tools, or internal infrastructure
- **Internal URLs**: No links to internal dashboards, wikis, Slack channels, or internal services
- **Infrastructure assumptions**: No references to specific cloud providers, internal clusters, or internal deployment targets as if they're the only option
- **Internal warnings or notices**: No banners, alerts, or messages about internal systems, outages, or company-specific policies
- **Employee-specific language**: No "talk to the platform team", "file a ticket in [internal tool]", or similar

## What to Do Instead

- Write **generic, vendor-neutral** copy that applies to any user
- Reference **configurable settings** rather than hardcoded internal values (e.g., backend URL is configurable, not pointed at an internal endpoint)
- Use **general cloud/ML terminology** (e.g., "your backend" not "the Shopify backend")
- For infrastructure-specific behavior, make it **configurable** via environment variables or settings, not hardcoded
- Error messages should guide users to **general troubleshooting steps**, not internal escalation paths

## Examples

```
// Bad — Shopify-specific
"Contact the ML Platform team on #ml-platform-support for help."
"This pipeline requires access to the Shopify GCP project."
"Warning: Shopify infrastructure maintenance scheduled."

// Good — vendor-neutral
"Check your backend connection settings."
"This pipeline requires a configured backend endpoint."
"Unable to connect to the backend. Verify your settings."
```

## When Internal Context Is Needed

If Shopify-specific configuration or documentation is needed, it belongs in:

- **Environment variables** (configured at deployment, not in code)
- **External documentation** (internal wikis, not in-app)
- **The backend** (server-side configuration, not frontend hardcoding)

Never put it in the frontend source code, UI copy, or committed configuration files.
