# Vivarium

Local dev stack manager CLI. Single runtime dependency (`commander`), ~500 lines of TypeScript.

## Commands

| Command        | Purpose                  |
|----------------|--------------------------|
| `pnpm build`   | Compile TypeScript to `dist/` |
| `pnpm dev`     | Watch mode compilation   |

No test framework is configured.

## Architecture

```
src/
├── cli.ts              # Commander entrypoint — registers 6 subcommands
├── config.ts           # Loads vivarium.json or package.json["vivarium"]
├── ports.ts            # Deterministic port computation from index (0–99)
├── registry.ts         # Project state management in ~/.local/share/vivarium/<name>/
├── compose.ts          # Docker Compose YAML generation via template literals
├── env.ts              # .env generation (compose interpolation + per-package)
├── commands/
│   ├── setup.ts        # Full setup flow (12 steps)
│   ├── teardown.ts     # Full teardown + legacy .vivarium/ migration
│   ├── start.ts        # docker compose up (no setup logic)
│   ├── stop.ts         # docker compose down (no teardown logic)
│   ├── compose.ts      # Pass-through to docker compose
│   └── mcp-proxy.ts    # stdio→SSE bridge for MCP services
└── utils/
    ├── docker.ts       # docker/docker compose exec helpers
    ├── logger.ts       # ANSI color-coded logger
    └── prerequisites.ts # docker + jq availability check
```

## Key Design Decisions

- **No YAML library.** Compose files are generated with template literals. Keep it that way.
- **No tests.** The project has no test framework configured.
- **Zero-config port allocation.** `ports.ts` computes all ports from a single index. MCP sidecars are only accessed within the Docker network (no host-bound port).
- **Registry = directories.** `~/.local/share/vivarium/<project>/` contains state.json, compose.yaml, .env. No files are written to the consuming project directory.
- **Convention-based env generation.** Packages named `backend` and `frontend` get standard env vars automatically (`env.ts`). Custom `env` entries in config override conventions.

## Conventions

- TypeScript ESM (`"type": "module"`)
- All imports use `.js` extension (required for ESM)
- JSDoc on all exported functions
- `execFileSync` preferred over `execSync` (no shell injection risk)
- Synchronous I/O throughout — no async, the CLI runs sequentially

## Gotchas

- All commands receive `projectRoot` (from `process.cwd()`) and resolve the project name from `package.json`. If there's no `package.json`, it falls back to `path.basename`.
- `autoAssignIndex` in `registry.ts` does NOT call `writeState` — setup.ts calls `writeState` after services are running. The index is only "soft-claimed" until state is written.
- The `compose` command uses `allowUnknownOption()` + `allowExcessArguments()` in commander to pass through arbitrary args to docker compose.
- Port collision check in `autoAssignIndex` compares candidate ports against ALL ports of ALL claimed projects, not just same-service ports.
