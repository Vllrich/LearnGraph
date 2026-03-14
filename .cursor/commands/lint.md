# Pre-Push Checks

Run lint and build, fix any errors, write a meaningful commit message, then push.

```bash
pnpm lint && pnpm --filter web build
```

Commit message must summarize the *why*, not the *what* — e.g. "fix quiz score drift on concurrent sessions" not "update route.ts".
