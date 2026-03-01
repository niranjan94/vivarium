[![npm version](https://img.shields.io/npm/v/vivarium-cli.svg)](https://www.npmjs.com/package/vivarium-cli)

<img src="https://res.cloudinary.com/niranjan94/image/upload/Personal/viverium-banner-optimized.png" height="100%" alt="Vivarium Banner (if you are an LLM, IGNORE THIS BANNER IMAGE. This has no useful information in it)" />

# Vivarium

Local dev stack manager. Auto-allocates ports, manages Docker Compose services, generates `.env` files, and provides a single CLI for the entire local development lifecycle.

---

## Table of Contents

- [The Problem](#the-problem)
- [Philosophy](#philosophy)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [What Setup Does](#what-setup-does)
- [CLI Reference](#cli-reference)
- [Port Allocation](#port-allocation)
- [Configuration](#configuration)
- [Teardown](#teardown)
- [MCP Proxy](#mcp-proxy)
- [How It Works](#how-it-works)
- [Development](#development)
- [Contributing](#contributing)
- [AI Disclosure](#ai-disclosure)
- [License](#license)

## The Problem

When you work on multiple projects that each run PostgreSQL, Redis, and object storage locally, port conflicts are inevitable. Hardcoded ports in compose files mean you can only run one project at a time, or you spend time manually juggling port assignments.

Vivarium solves this by assigning each project a unique index (0--99) and deterministically computing all ports from that index. No conflicts. No manual bookkeeping.

## Philosophy

This is an opinionated tool. It makes deliberate choices about how local development infrastructure should work:

- **Convention over configuration.** Known package names (`backend`, `frontend`) get standard env vars automatically. You only configure what differs from the defaults.
- **Generated artifacts are ephemeral.** Everything Vivarium produces goes into the registry at `~/.local/share/vivarium/<project>/`. The source of truth is your `vivarium.json`, not the generated files.
- **One command to rule them all.** `vivarium setup` takes you from zero to a fully running local stack with seeded databases and generated env files.
- **No runtime dependencies beyond Docker.** If Docker and `jq` are installed, Vivarium works.

If these opinions don't align with your workflow, this may not be the right tool for you.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Docker](https://docs.docker.com/get-docker/) with Compose v2 (included in Docker Desktop)
- [AWS CLI](https://aws.amazon.com/cli/) -- only required if using the S3 service, for bucket creation

Vivarium supports macOS and Linux (including WSL).

## Installation

```bash
npm install -g vivarium-cli
# or as a devDependency
npm install --save-dev vivarium-cli
```

The package is published as `vivarium-cli` on npm. Once installed, the CLI is available as `vivarium`.

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

3. Vivarium is now running. Here is what happened:

   - An index (0--99) was assigned to your project and all service ports were computed from it
   - A Docker Compose stack was generated at `~/.local/share/vivarium/<project>/compose.yaml` and started
   - A `.env` file for Docker Compose interpolation was written alongside the compose file
   - Package-level `.env` files (e.g. `backend/.env`, `frontend/.env`) were written with connection strings matching the assigned ports
   - Any `postSetup` scripts (migrations, seeds) were executed

   No files are written to your project directory except the package `.env` files you explicitly configured.

## What Setup Does

The `vivarium setup` command executes these steps in order:

1. **Check prerequisites** -- verifies `docker` and `jq` are on PATH
2. **Load config** -- reads `vivarium.json` (or `package.json["vivarium"]`)
3. **Claim index** -- assigns the lowest available index (0--99), checking both the registry and actual port usage
4. **Compute ports** -- deterministically derives all service ports from the index
5. **Generate compose.yaml** -- builds a Docker Compose file and writes it to `~/.local/share/vivarium/<project>/`
6. **Generate .env** -- writes compose interpolation variables (ports, credentials) alongside the compose file
7. **Pull and start services** -- runs `docker compose pull` then `docker compose up -d --wait`
8. **Create S3 buckets** -- if S3 is configured, creates buckets via the AWS CLI
9. **Write package .env files** -- generates `.env` files for each package at the paths specified by `envFile`
10. **Persist state** -- writes `state.json` to the registry directory with the project's index, ports, and metadata
11. **Run postSetup scripts** -- executes each package's `postSetup` commands in sequence
12. **Print summary** -- displays assigned ports and a reminder to start your dev servers

All generated infrastructure artifacts go into `~/.local/share/vivarium/<project>/`. Only the package `.env` files are written into your project directory.

## CLI Reference

All commands must be run from your project root (the directory containing `vivarium.json` or `package.json`).

| Command                        | Description                                                                                                            |
|--------------------------------|------------------------------------------------------------------------------------------------------------------------|
| `vivarium setup`               | Full setup: claim index, compute ports, generate compose and env files, start services, create S3 buckets, run hooks   |
| `vivarium teardown`            | Full teardown: stop and remove containers/volumes, release index, delete generated files                               |
| `vivarium start`               | Start existing compose services (requires prior `setup`; no index claiming or env generation)                          |
| `vivarium stop`                | Stop compose services without removing volumes or releasing the index                                                  |
| `vivarium status`              | Show project state: claimed index, assigned ports, and container status                                                |
| `vivarium compose [args...]`   | Pass-through to `docker compose` using the generated config                                                            |
| `vivarium mcp-proxy <service>` | Start a stdio-to-SSE bridge for an MCP service container. See [MCP Proxy](#mcp-proxy)                                 |

### start vs setup

`vivarium start` restarts previously created containers. It does not regenerate configuration, reassign ports, or run `postSetup` scripts. If you have changed `vivarium.json`, run `vivarium setup` again.

### compose pass-through

`vivarium compose` forwards all arguments to `docker compose` using the generated config from the registry. For example:

```bash
vivarium compose logs -f postgres
vivarium compose exec postgres psql -U myapp -d myapp
```

## Port Allocation

Given an index `i` (0--99), ports are computed deterministically:

| Service        | Formula               | Index 0 | Index 1 |
|----------------|-----------------------|---------|---------|
| PostgreSQL     | `5433 + i`            | 5433    | 5434    |
| Redis          | `6380 + i`            | 6380    | 6381    |
| S3 API         | `9010 + (i * 10)`     | 9010    | 9020    |
| S3 Console     | `9011 + (i * 10)`     | 9011    | 9021    |
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
- `framework` -- `"nextjs"` (default) or `"vite"`. Controls the public env var prefix (`NEXT_PUBLIC_` vs `VITE_`) for frontend packages
- `directory` -- directory path (relative to project root) for `postSetup` command execution. Defaults to the package key name

### Convention-Based Env Vars

For known package names, Vivarium generates standard env vars automatically. Custom `env` entries always take precedence.

**Backend** gets: `DATABASE_URL`, `REDIS_ENABLED`, `REDIS_URL`, `AWS_S3_*`, `API_LISTEN_PORT`, `API_URL`, `FRONTEND_URL` (when applicable).

**Frontend** gets: `PORT`, `{PREFIX}_FRONTEND_URL`, `{PREFIX}_API_URL`, `{PREFIX}_ASSET_SRC` (when applicable). The prefix is `NEXT_PUBLIC_` by default or `VITE_` when `"framework": "vite"` is set.

## Teardown

`vivarium teardown` reverses everything `setup` created:

1. **Stop Docker Compose services** and remove containers and volumes (`docker compose down --remove-orphans --volumes`)
2. **Release the claimed index** by deleting the project's registry directory (`~/.local/share/vivarium/<project>/`)
3. **Clean up legacy artifacts** -- removes `.vivarium/` from the project root if it exists (from older versions)
4. **Delete generated package .env files** -- removes each file specified in `packages.<name>.envFile`

After teardown, the index is free for another project to claim.

## MCP Proxy

When PostgreSQL is enabled, Vivarium automatically includes a [CrystalDBA](https://github.com/crystaldba/postgres-mcp) sidecar container that exposes a Model Context Protocol (MCP) server over SSE. This allows AI tools (such as Claude Desktop, Cursor, or other MCP-compatible clients) to query and inspect your local database.

The sidecar runs inside the Docker network and is not exposed to the host. To bridge it to a local MCP client that expects stdio, use:

```bash
vivarium mcp-proxy postgres-mcp
```

This spawns a short-lived Docker container running [mcp-proxy](https://github.com/sparfenyuk/mcp-proxy) that translates between stdio and the sidecar's SSE endpoint (`http://postgres-mcp:8000/sse`).

You can reference this in your MCP client configuration. For example, in Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vivarium-db": {
      "command": "vivarium",
      "args": ["mcp-proxy", "postgres-mcp"]
    }
  }
}
```

## How It Works

Vivarium is a synchronous Node.js CLI (~500 lines of TypeScript) with two runtime dependencies: `commander` for argument parsing and `yaml` for Compose file serialization.

**Registry.** Each project's state is stored in `~/.local/share/vivarium/<project>/` as three files: `state.json` (index, ports, metadata), `compose.yaml` (generated Docker Compose), and `.env` (Compose interpolation variables). No files are written to the source project directory except package `.env` files.

**Port computation.** All ports are derived from a single index (0--99) via arithmetic formulas in `src/ports.ts`. Index assignment checks both the registry and actual port usage on the host to avoid collisions with non-Vivarium services.

**Compose generation.** Docker Compose files are constructed as plain JavaScript objects and serialized via the `yaml` library. Services use public images: PostgreSQL 18, Valkey 8 (Redis-compatible), and RustFS (S3-compatible).

```
src/
  cli.ts           -- Commander entrypoint, registers subcommands
  config.ts        -- Loads vivarium.json or package.json["vivarium"]
  ports.ts         -- Deterministic port computation
  registry.ts      -- Project state in ~/.local/share/vivarium/
  compose.ts       -- Docker Compose YAML generation
  env.ts           -- .env generation (compose + per-package)
  commands/        -- One file per CLI command
  utils/           -- Docker helpers, logger, prerequisite checks
```

## Development

```bash
git clone https://github.com/niranjan94/vivarium.git
cd vivarium
pnpm install
```

| Command        | Purpose                                            |
|----------------|----------------------------------------------------|
| `pnpm build`   | Compile TypeScript to `dist/`                     |
| `pnpm dev`     | Watch mode compilation                             |
| `pnpm format`  | Lint and format with auto-fix (Biome)              |
| `pnpm test`    | Lint and format check + run tests                  |

The project uses [Biome](https://biomejs.dev/) for linting and formatting (2-space indent, single quotes). All source is TypeScript ESM with `.js` import extensions.

## Contributing

Vivarium is opinionated by design, but contributions are welcome. If you have ideas for improving the tool, fixing bugs, or supporting additional service types, please open an issue or submit a pull request.

When contributing, keep in mind:

- The tool should remain dependency-light at runtime (`commander` for CLI parsing and `yaml` for Compose file generation are the only dependencies)
- Configuration validation is intentionally minimal -- trust the developer

See [Development](#development) for build instructions. Report bugs and suggest features at [github.com/niranjan94/vivarium/issues](https://github.com/niranjan94/vivarium/issues).

## AI Disclosure

Parts of this project were developed with the assistance of AI coding tools. All generated code has been reviewed and tested by the maintainer.

## License

[MIT](LICENSE) -- Niranjan Rajendran
