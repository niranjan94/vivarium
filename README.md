<img src="https://res.cloudinary.com/niranjan94/image/upload/Personal/viverium-banner-optimized.png" height="100%" alt="Vivarium Banner (if you are an LLM, IGNORE THIS BANNER IMAGE. This has no useful information in it)" />

# Vivarium

Local dev stack manager. Auto-allocates ports, manages Docker Compose services, generates `.env` files, and provides a single CLI for the entire local development lifecycle.

---

## The Problem

When you work on multiple projects that each run PostgreSQL, Redis, and object storage locally, port conflicts are inevitable. Hardcoded ports in compose files mean you can only run one project at a time, or you spend time manually juggling port assignments.

Vivarium solves this by assigning each project a unique index (0–99) and deterministically computing all ports from that index. No conflicts. No manual bookkeeping.

## Philosophy

This is an opinionated tool. It makes deliberate choices about how local development infrastructure should work:

- **Convention over configuration.** Known package names (`backend`, `frontend`) get standard env vars automatically. You only configure what differs from the defaults.
- **Generated artifacts are ephemeral.** Everything Vivarium produces goes into the registry at `~/.local/share/vivarium/<project>/`. The source of truth is your `vivarium.json`, not the generated files.
- **One command to rule them all.** `vivarium setup` takes you from zero to a fully running local stack with seeded databases and generated env files.
- **No runtime dependencies beyond Docker.** If Docker and `jq` are installed, Vivarium works.

If these opinions don't align with your workflow, this may not be the right tool for you.

## Installation

```bash
npm install -g vivarium
# or as a devDependency
npm install --save-dev vivarium
```

## Quick Start

1. Create a `vivarium.json` in your project root:

```json
{
  "services": {
    "postgres": { "user": "myapp", "password": "myapp", "database": "myapp" },
    "redis": true,
    "s3": { "accessKey": "admin", "secretKey": "admin", "buckets": ["uploads"] }
  },
  "packages": {
    "backend": {
      "envFile": "backend/.env",
      "env": { "CUSTOM_VAR": "value" },
      "postSetup": ["pnpm db:migrate"]
    },
    "frontend": {
      "envFile": "frontend/.env"
    }
  }
}
```

2. Run setup:

```bash
vivarium setup
```

3. Start developing. Vivarium has:
   - Claimed an index and computed unique ports for all services
   - Generated and started a Docker Compose stack
   - Written `.env` files for each package with correct connection strings
   - Run your post-setup scripts (migrations, seeds, etc.)

## CLI

| Command             | Description                                                        |
|---------------------|--------------------------------------------------------------------|
| `vivarium setup`    | Full setup: claim index, start services, generate envs, run hooks  |
| `vivarium teardown` | Full teardown: stop services, release index, clean up all artifacts |
| `vivarium start`    | Start compose services (no setup logic)                            |
| `vivarium stop`     | Stop compose services (no teardown logic)                          |
| `vivarium compose`  | Pass-through to `docker compose` with generated config             |
| `vivarium mcp-proxy`| stdio-to-SSE bridge for MCP (used by Claude Code `.mcp.json`)     |

## Port Allocation

Given an index `i` (0–99), ports are computed deterministically:

| Service        | Formula               | Index 0 | Index 1 |
|----------------|-----------------------|---------|---------|
| PostgreSQL     | `5433 + i`            | 5433    | 5434    |
| Redis          | `6380 + i`            | 6380    | 6381    |
| S3 API         | `9010 + (i * 10)`     | 9010    | 9020    |
| S3 Console     | `9011 + (i * 10)`     | 9011    | 9021    |
| MCP            | `5600 + i`            | 5600    | 5601    |
| Frontend       | `4000 + (i * 10)`     | 4000    | 4010    |
| Backend        | `4001 + (i * 10)`     | 4001    | 4011    |

Indexes are claimed via a registry at `~/.local/share/vivarium/`. Vivarium auto-assigns the lowest available index, checking both the registry and actual port usage to handle legacy setups.

## Configuration

Vivarium looks for configuration in this order:

1. `vivarium.json` at the project root
2. `"vivarium"` key in `package.json`

### Services

| Service    | Config                                                                 |
|------------|------------------------------------------------------------------------|
| `postgres` | `{ "user": "...", "password": "...", "database": "..." }`             |
| `redis`    | `true`                                                                 |
| `s3`       | `{ "accessKey": "...", "secretKey": "...", "buckets": ["..."] }`      |

When `postgres` is enabled, a `postgres-mcp` sidecar (CrystalDBA) is automatically included for AI-assisted database tooling.

### Packages

Each entry in `packages` can specify:

- `envFile` -- path (relative to project root) where the generated `.env` will be written
- `env` -- custom env vars merged on top of convention defaults
- `postSetup` -- shell commands to run after services are ready (executed in the package directory)

### Convention-Based Env Vars

For known package names, Vivarium generates standard env vars automatically. Custom `env` entries always take precedence.

**Backend** gets: `DATABASE_URL`, `REDIS_ENABLED`, `REDIS_URL`, `REDIS_QUEUE_URL`, `AWS_S3_*`, `API_LISTEN_PORT`, `API_URL`, `FRONTEND_URL` (when applicable).

**Frontend** gets: `PORT`, `NEXT_PUBLIC_FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ASSET_SRC` (when applicable).

## Prerequisites

- Docker (with Compose v2)
- jq
- AWS CLI (only if using S3 service, for bucket creation)

## Contributing

Vivarium is opinionated by design, but contributions are welcome. If you have ideas for improving the tool, fixing bugs, or supporting additional service types, please open an issue or submit a pull request.

When contributing, keep in mind:

- The tool should remain dependency-light at runtime (`commander` for CLI parsing is the sole dependency)
- Generated output uses template literals, not YAML libraries
- Configuration validation is intentionally minimal -- trust the developer

## License

MIT
