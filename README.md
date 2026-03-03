[![Test](https://github.com/niranjan94/vivarium/actions/workflows/test.yml/badge.svg)](https://github.com/niranjan94/vivarium/actions/workflows/test.yml) [![npm version](https://img.shields.io/npm/v/vivarium-cli.svg)](https://www.npmjs.com/package/vivarium-cli)

# Vivarium

Local dev stack manager. Auto-allocates ports, manages Docker Compose services, generates `.env` files, and provides a single CLI for the entire local development lifecycle.

## The Problem

When you work on multiple projects that each run PostgreSQL, Redis, and object storage locally, port conflicts are inevitable. Vivarium solves this by assigning each project a unique index and deterministically computing all ports from it. No conflicts. No manual bookkeeping.

## Philosophy

- **Convention over configuration.** Sensible defaults for ports, service names, and env vars mean minimal config for common stacks.
- **Generated artifacts are ephemeral.** Compose files and `.env` files are regenerated on every setup. Don't edit them by hand.
- **One command to rule them all.** `vivarium setup` does everything: allocates ports, generates config, starts services, runs post-setup hooks.
- **No runtime dependencies beyond Docker.** Node.js is only needed to run the CLI itself.

If these opinions don't align with your workflow, this may not be the right tool for you.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Docker](https://docs.docker.com/get-docker/) with Compose v2 (included in Docker Desktop)
- [AWS CLI](https://aws.amazon.com/cli/) -- only required if using the S3 service

## Installation

```bash
npm install -g vivarium-cli
```

## Quick Start

1. Create a `vivarium.json` in your project root:

```json
{
  "services": {
    "postgres": { "user": "myapp", "password": "myapp", "database": "myapp" },
    "redis": true
  },
  "packages": {
    "backend": {
      "envFile": "backend/.env",
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

For the full configuration schema and all available options, see the [documentation](https://vivarium.niranjan.io).

## Documentation

Full documentation is at **[vivarium.niranjan.io](https://vivarium.niranjan.io)**.

- [CLI reference](https://vivarium.niranjan.io/docs/reference/commands)
- [Configuration schema](https://vivarium.niranjan.io/docs/reference/configuration)
- [Environment variables](https://vivarium.niranjan.io/docs/reference/environment)
- [Port allocation](https://vivarium.niranjan.io/docs/internals/port-allocation)
- [MCP proxy](https://vivarium.niranjan.io/docs/guides/mcp-integration)
- [Architecture](https://vivarium.niranjan.io/docs/internals/architecture)

## Development

```bash
git clone https://github.com/niranjan94/vivarium.git
cd vivarium
pnpm install
```

| Command        | Purpose                                       |
|----------------|-----------------------------------------------|
| `pnpm build`   | Compile TypeScript to `dist/`                 |
| `pnpm dev`     | Watch mode compilation                        |
| `pnpm format`  | Lint and format with auto-fix (Biome)         |
| `pnpm test`    | Lint and format check + run tests             |

## Contributing

Contributions are welcome -- open an issue or submit a pull request. Report bugs and suggest features at [github.com/niranjan94/vivarium/issues](https://github.com/niranjan94/vivarium/issues).

## License

[MIT](LICENSE) -- Niranjan Rajendran
